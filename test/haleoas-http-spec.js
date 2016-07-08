'use strict';

import test from 'blue-tape'
import haleoas from '../src/haleoas.js'
import fetchMock from 'fetch-mock'
import deepEqual from 'deep-equal'
import 'isomorphic-fetch'

const getOrigin = () => {
    if(typeof window !== 'undefined' ) { return window.location.origin}
    return 'http://example.com'
}
const origin = getOrigin()
const hal = (spec) => {
    return haleoas({ fetch })(spec)
}

const fullyLoaded = () => {
    let body = {
        "_links": {
            "self": { "href": `${origin}/orders` },
            "curies": [{ "name": "ea", "href": "http://example.com/docs/rels/{rel}", "templated": true }],
            "next": { "href": `${origin}/orders?page=2` },
            "ea:find": {
                "href": `${origin}/orders{?id}`,
                "templated": true
            },
            "ea:multi": [
                { "href": `${origin}/a{?foo}`, "templated":true},
                { "href": `${origin}/b{?foo}`, "templated":true},
                { "href": `${origin}/c{?foo}`, "templated":true}
            ],
            "ea:admin": [{
                "href": `${origin}/admins/2`,
                "title": "Fred"
            }, {
                "href": `${origin}/admins/5`,
                "title": "Kate"
            }]
        },
        "currentlyProcessing": 14,
        "shippedToday": 20,
        "_embedded": {
            "ea:order": [{
                "_links": {
                    "self": { "href": `${origin}/orders/123` },
                    "ea:basket": { "href": `${origin}/baskets/98712` },
                    "ea:customer": { "href": `${origin}/customers/7809` }
                },
                "total": 30.00,
                "currency": "USD",
                "status": "shipped"
            }, {
                "_links": {
                    "self": { "href": `${origin}/orders/124` },
                    "ea:basket": { "href": `${origin}/baskets/97213` },
                    "ea:customer": { "href": `${origin}/customers/12369` }
                },
                "total": 20.00,
                "currency": "USD",
                "status": "processing"
            }]
        }
    }
    return body
}

test('invalid content-type doesnt throw',(assert) => {
    fetchMock.mock(`${origin}/orders`,'get', {
        body: 'plain'
        ,headers: {
            'content-type': 'text/plain'
            , 'content-length': 5
        }
        ,status: 200
    })

    let sut = hal({
        self: `${origin}/orders`
    })
    return sut.get().catch((err) => {
        assert.equal(err.message,'illegal content type at ${origin}/orders : text/plain')
    })
    .then(fetchMock.restore.bind(fetchMock))

})
test('simple HEAD works',(assert) => {
    let self = { href: `${origin}/orders`}
    fetchMock.mock(self.href, 'head', {
        headers: {
            'content-type': 'application/hal+json'
            , 'content-length': 0
            , 'allow': 'GET,PUT,POST,DELETE'
        }
        ,status: 204
        , body: null
    })

    let sut = hal({
        self: self.href
    })
    return sut.head().then((it) => {
        assert.deepEqual(sut.allow(),['GET','PUT','POST','DELETE'])
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('simple OPTIONS works',(assert) => {
    let self = { href: `${origin}/orders`}
    fetchMock.mock(self.href, 'options', {
        headers: {
            'content-type': 'application/hal+json'
            , 'content-length': 0
            , 'allow': 'GET,PUT,POST,DELETE'
        }
        ,status: 204
        ,body: null
    })

    let sut = hal({
        self: self.href
    })
    return sut.options().then((it) => {
        assert.deepEqual(sut.allow(),['GET','PUT','POST','DELETE'])
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('simple GET works',(assert) => {
    let body = fullyLoaded()
    let matcher = (url, opts) => {
        let {accept} = opts.headers
        return accept === 'application/hal+json' && url === `${origin}/orders`
    }
    fetchMock.mock(matcher, 'get', {
        body
        ,headers: {
            'content-type': 'application/hal+json'
            , 'content-length': JSON.stringify(body).length
        }
        ,status: 200
    })

    let sut = hal({
        self: `${origin}/orders`
    })
    return sut.get().then((it) => {
        assert.equal(sut.currentlyProcessing,14)
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('content-type with encoding works',(assert) => {
    let body = fullyLoaded()
    let matcher = (url, opts) => {
        let {accept} = opts.headers
        return accept === 'application/hal+json' && url === `${origin}/orders`
    }
    fetchMock.mock(matcher, 'get', {
        body
        ,headers: {
            'content-type': 'application/hal+json; charset=utf-8'
            , 'content-length': JSON.stringify(body).length
        }
        ,status: 200
    })

    let sut = hal({
        self: `${origin}/orders`
    })
    return sut.get().then((it) => {
        assert.equal(sut.currentlyProcessing,14)
    })
    .then(fetchMock.restore.bind(fetchMock))
})

test('GET with RFC6570 params works',(assert) => {
    let body = fullyLoaded()
    fetchMock.mock(`${origin}/orders?page=2&size=10`, 'get', {
        body
        ,headers: {
            'content-type': 'application/hal+json'
            , 'content-length': JSON.stringify(body).length
        }
        ,status: 200
    })

    let sut = hal({
        self: `${origin}/orders{?page,size}`
    })
    return sut.get({ params: {page:2,size:10}}).then((it) => {
        assert.equal(sut.currentlyProcessing,14)
    })
    .then(fetchMock.restore.bind(fetchMock))
})

test('GET with http errors dont fail',(assert) => {
    fetchMock.mock(`${origin}/orders`, 'get', {
        body: 'You suck'
        ,headers: {
            'content-type': 'text/plain'
            , 'content-length': 8
        }
        ,status: 400
        , statusText: 'Bad Request'
    })

    let sut = hal({
        self: `${origin}/orders`
    })
    return sut.get().catch((err) => {
        assert.equal(err.message,'Yousuck')
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('simple POST works',(assert) => {
    let body = fullyLoaded()
    let matcher = (url, opts) => {
        let {'content-type':contentType} = opts.headers
        let { body} = opts
        return contentType === 'application/json' &&
            url === `${origin}/orders` &&
            body === JSON.stringify({foo:'bar'})
    }
    fetchMock.mock(matcher, 'post', {
        body: null
        , headers: {
            'content-type': 'application/hal+json'
            , 'content-length': 0
        }
        ,status: 204
    })

    let sut = hal({
        self: `${origin}/orders`
    })
    return sut.post({data: {foo:'bar'}}).then(({response, resource}) => {
        assert.equal(response.status, 204)
        assert.equal(resource.self,`${origin}/orders`)
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('simple POST with expanded url works',(assert) => {
    let body = fullyLoaded()
    let matcher = (url, opts) => {
        let {'content-type':contentType} = opts.headers
        let { body} = opts
        return contentType === 'application/json' &&
            url === `${origin}/orders?q=why` &&
            body === JSON.stringify({foo:'bar'})
    }
    fetchMock.mock(matcher, 'post', {
        body: null
        , headers: {
            'content-type': 'application/hal+json'
            , 'content-length': 0
        }
        ,status: 204
    })

    let sut = hal({
        self: `${origin}/orders{?q}`
    })
    return sut.post({data: {foo:'bar'}, params: { q: 'why' }}).then(({response, resource}) => {
        assert.equal(response.status, 204)
        assert.equal(resource.self,`${origin}/orders{?q}`)
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('POST resulting in location follows created entity',(assert) => {
    let body = fullyLoaded()
    let matcher = (url, opts) => {
        let {'content-type':contentType} = opts.headers
        let { body} = opts
        return contentType === 'application/json' &&
            url === `${origin}/orders` &&
            body === JSON.stringify({foo:'bar'})
    }
    fetchMock.mock(matcher, 'post', {
        headers: {
            'content-type': 'application/hal+json'
            , 'content-length': 0
            , location: `${origin}/orders/1`
        }
        ,status: 201
        , body: null
    })
    let newBody = {
        _links: { self: { href: `${origin}/orders/1` }}
        , bar: 'foo'
    }
    fetchMock.mock(`${origin}/orders/1`, 'get', {
        body: newBody
        , headers: {
            'content-type': 'application/hal+json'
            , 'content-length': JSON.stringify(newBody).length
        }
        ,status: 200
    })

    let sut = hal({
        self: `${origin}/orders`
    })
    return sut.post({ data: {foo:'bar'}}).then(({resource}) => {
        assert.equal(resource.self,`${origin}/orders/1`)
        assert.equal(resource.bar,'foo')
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('DELETE works',(assert) => {
    fetchMock.mock(`${origin}/orders`, 'delete', {
        headers: {
            'content-type': 'application/hal+json'
            , 'content-length': 0
        }
        ,status: 204
        , body: null
    })

    let sut = hal({
        self: `${origin}/orders`
    })
    return sut.delete().then(({response, resource}) => {
        assert.equal(response.status, 204)
        assert.equal(resource.self,`${origin}/orders`)
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('PUT resulting sends full body and syncs',(assert) => {
    let self = { href: `${origin}/orders`}
    let bodyBefore = fullyLoaded()
    let bodyAfter = fullyLoaded()
    let expectBody = Object.assign(
        {currentlyProcessing: 14, foo: 'bar'}
        , { _embedded: bodyBefore._embedded }
    )
    let matcher = (url, opts) => {
        let {'content-type':contentType} = opts.headers
        return contentType === 'application/json' &&
            url === self.href &&
            deepEqual(JSON.parse(opts.body), expectBody)
    }
    fetchMock.mock(matcher, 'put', {
        headers: { 'content-length': 0 }
        ,status: 204
        , body: null
    })
    fetchMock.mock(self.href, 'get', {
        body: bodyAfter
        , headers: {
            'content-type': 'application/hal+json'
            , 'content-length': JSON.stringify(bodyAfter).length
        }
        ,status: 200
    })

    let body = fullyLoaded()
    let sut = hal({
        self: self.href
        , body:bodyBefore
    })
    //add an attribute, remove an attribute
    sut.foo = 'bar'
    ;(delete sut.shippedToday)

    //verify we reget our things
    bodyAfter.foo = 'baz'
    return sut.put().then(({resource}) => {
        assert.equal(resource.self,self.href)
        assert.equal(resource.foo,'baz')
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('PATCH works (RFC6902) and refetches the resource', (assert) => {
    let self = { href: `${origin}/orders/1` }
    let body = {
        _links: { self}
        , foo: 'bar'
        , deep: {
            thoughts: 'jack'
        }
    }
    let matcher = function(url, opts) {
        let {body} = opts
        let patches = [ {
            op: 'replace', path: '/foo', value: 'baz'
        }, {
            op: 'replace', path: '/deep/thoughts', value: 'jazz'
        } ]

        let {'content-type':contentType} = opts.headers
        return url === self.href &&
            deepEqual(patches, body) &&
            contentType === 'application/json-patch+json'
    }

    let responseBody = {
        _links: {
            self
        }
        , foo: 'baz'
        , deep: { thoughts: 'jazz' }
    }
    fetchMock.mock(matcher, 'patch', {
        headers: {
            'content-type': 'application/hal+json'
            ,'content-length': 0
        }
        ,status: 204
        , body: null
    })
    .mock(self.href, 'get', {
        headers: {
            'content-type': 'application/hal+json'
            , 'content-length': JSON.stringify(responseBody).length
        }
        , body: responseBody
        ,status: 200
    })

    let sut = hal({
        self: self.href
        , body
    })
    return sut.patch({ foo: 'baz', deep: { thoughts: 'jazz'}})
    .then(({response, resource}) => {
        assert.equal(response.status,200)
        assert.equal(resource.self,self.href)
        assert.equal(resource.foo, 'baz')
        assert.equal(resource.deep.thoughts, 'jazz')
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('PATCH uses current state against original (RFC6902) and refetches the resource', (assert) => {
    let origin = getOrigin()
    let self = { href: `${origin}/orders/1` }
    let body = {
        _links: { self}
        , foo: 'bar'
        , deep: {
            thoughts: 'jack'
        }
    }

    let matcher = function(url, opts) {
        let {body} = opts
        let patches = [ {
            op: 'replace', path: '/foo', value: 'baz'
        }, {
            op: 'replace', path: '/deep/thoughts', value: 'jazz'
        } ]

        let {'content-type':contentType} = opts.headers
        return url === self.href &&
            deepEqual(patches, body) &&
            contentType === 'application/json-patch+json'
    }

    let responseBody = {
        _links: {
            self
        }
        , foo: 'baz'
        , deep: { thoughts: 'jazz' }
    }
    fetchMock.mock(matcher, 'patch', {
        headers: {
            'content-type': 'application/hal+json'
            ,'content-length': 0
        }
        ,status: 204
        , body: null
    })
    .mock(self.href, 'get', {
        headers: {
            'content-type': 'application/hal+json'
            , 'content-length': JSON.stringify(responseBody).length
        }
        , body: responseBody
        ,status: 200
    })

    let sut = hal({
        self: self.href
        , body
    })
    sut.foo = 'baz'
    sut.deep = { thoughts: 'jazz'}
    return sut.patch()
    .then(({response, resource}) => {
        assert.equal(response.status,200)
        assert.equal(resource.self,self.href)
        assert.equal(resource.foo, 'baz')
        assert.equal(resource.deep.thoughts, 'jazz')
    })
    .then(fetchMock.restore.bind(fetchMock))
})
