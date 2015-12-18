'use strict';

import test from 'blue-tape'
import hal from '../src/haleoas.js'
import fetchMock from 'fetch-mock'
import deepEqual from 'deep-equal'
import 'isomorphic-fetch'

const getOrigin = () => {
    if(window) { return window.location.origin}
    return 'http://example.com'
}
const origin = getOrigin()
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
    fetchMock.mock(`${origin}/orders`,'GET', {
        body: 'plain'
        ,headers: {
            'content-type': 'text/plain'
        }
        ,status: 200
    })

    let sut = hal({
        self: `${origin}/orders`
        , fetch
    })
    return sut.get().catch((err) => {
        assert.equal(err.message,'illegal content type at ${origin}/orders : text/plain')
    })
    .then(fetchMock.restore.bind(fetchMock))

})
test('simple HEAD works',(assert) => {
    let self = { href: `${origin}/orders`}
    fetchMock.mock(self.href, 'HEAD', {
        headers: {
            'content-type': 'application/hal+json'
            , 'allow': 'GET,PUT,POST,DELETE'
        }
        ,status: 204
        , body: null
    })

    let sut = hal({
        self: self.href
        , fetch
    })
    return sut.head().then((it) => {
        assert.deepEqual(sut.allow(),['GET','PUT','POST','DELETE'])
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('simple OPTIONS works',(assert) => {
    let self = { href: `${origin}/orders`}
    fetchMock.mock(self.href, 'OPTIONS', {
        headers: {
            'content-type': 'application/hal+json'
            , 'allow': 'GET,PUT,POST,DELETE'
        }
        ,status: 204
        ,body: null
    })

    let sut = hal({
        self: self.href
        , fetch
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
    fetchMock.mock(matcher, 'GET', {
        body
        ,headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 200
    })

    let sut = hal({
        self: `${origin}/orders`
        , fetch
    })
    return sut.get().then((it) => {
        assert.equal(sut.currentlyProcessing,14)
    })
    .then(fetchMock.restore.bind(fetchMock))
})

test('GET with RFC6570 params works',(assert) => {
    let body = fullyLoaded()
    fetchMock.mock(`${origin}/orders?page=2&size=10`, 'GET', {
        body
        ,headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 200
    })

    let sut = hal({
        self: `${origin}/orders{?page,size}`
        , fetch
    })
    return sut.get({page:2,size:10}).then((it) => {
        assert.equal(sut.currentlyProcessing,14)
    })
    .then(fetchMock.restore.bind(fetchMock))
})

test('GET with http errors dont fail',(assert) => {
    fetchMock.mock(`${origin}/orders`, 'GET', {
        body: 'You suck'
        ,headers: {
            'content-type': 'text/plain'
        }
        ,status: 400
        , statusText: 'Bad Request'
    })

    let sut = hal({
        self: `${origin}/orders`
        , fetch
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
        return contentType === 'application/hal+json' &&
            url === `${origin}/orders` &&
            body === JSON.stringify({foo:'bar'})
    }
    fetchMock.mock(matcher, 'POST', {
        body: null
        , headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 204
    })

    let sut = hal({
        self: `${origin}/orders`
        , fetch
    })
    return sut.post({foo:'bar'}).then(({response, resource}) => {
        assert.equal(response.status, 204)
        assert.equal(resource.self,`${origin}/orders`)
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('POST resulting in location follows created entity',(assert) => {
    let body = fullyLoaded()
    let matcher = (url, opts) => {
        let {'content-type':contentType} = opts.headers
        let { body} = opts
        return contentType === 'application/hal+json' &&
            url === `${origin}/orders` &&
            body === JSON.stringify({foo:'bar'})
    }
    fetchMock.mock(matcher, 'POST', {
        headers: {
            'content-type': 'application/hal+json'
            , location: `${origin}/orders/1`
        }
        ,status: 201
        , body: null
    })
    fetchMock.mock(`${origin}/orders/1`, 'GET', {
        body: {
            _links: { self: { href: `${origin}/orders/1` }}
            , bar: 'foo'
        }
        , headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 200
    })

    let sut = hal({
        self: `${origin}/orders`
        , fetch
    })
    return sut.post({foo:'bar'}).then(({resource}) => {
        assert.equal(resource.self,`${origin}/orders/1`)
        assert.equal(resource.bar,'foo')
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('DELETE works',(assert) => {
    fetchMock.mock(`${origin}/orders`, 'DELETE', {
        headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 204
        , body: null
    })

    let sut = hal({
        self: `${origin}/orders`
        , fetch
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
    fetchMock.mock(matcher, 'PUT', {
        headers: { }
        ,status: 204
        , body: null
    })
    fetchMock.mock(self.href, 'GET', {
        body: bodyAfter
        , headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 200
    })

    let body = fullyLoaded()
    let sut = hal({
        self: self.href
        , fetch
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

    fetchMock.mock(matcher, 'PATCH', {
        headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 204
        , body: null
    })
    .mock(self.href, 'GET', {
        headers: {
            'content-type': 'application/hal+json'
        }
        , body: {
            _links: {
                self
            }
            , foo: 'baz'
            , deep: { thoughts: 'jazz' }
        }
        ,status: 200
    })

    let sut = hal({
        self: self.href
        , fetch
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
            op: 'replace', path: '/deep/thoughts', value: 'jazz'
        }, {
            op: 'replace', path: '/foo', value: 'baz'
        } ]

        let {'content-type':contentType} = opts.headers
        return url === self.href &&
            deepEqual(patches, body) &&
            contentType === 'application/json-patch+json'
    }

    fetchMock.mock(matcher, 'PATCH', {
        headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 204
        , body: null
    })
    .mock(self.href, 'GET', {
        headers: {
            'content-type': 'application/hal+json'
        }
        , body: {
            _links: {
                self
            }
            , foo: 'baz'
            , deep: { thoughts: 'jazz' }
        }
        ,status: 200
    })

    let sut = hal({
        self: self.href
        , fetch
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
