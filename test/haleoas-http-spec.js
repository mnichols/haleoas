'use strict';

import test from 'blue-tape'
import hal from '../src/haleoas.js'
import fetchMock from 'fetch-mock'
import deepEqual from 'deep-equal'
import 'isomorphic-fetch'

const fullyLoaded = () => {
    let body = {
        "_links": {
            "self": { "href": "http://a.com/orders" },
            "curies": [{ "name": "ea", "href": "http://example.com/docs/rels/{rel}", "templated": true }],
            "next": { "href": "http://a.com/orders?page=2" },
            "ea:find": {
                "href": "/orders{?id}",
                "templated": true
            },
            "ea:multi": [
                { "href": "http://a.com/a{?foo}", "templated":true},
                { "href": "http://a.com/b{?foo}", "templated":true},
                { "href": "http://a.com/c{?foo}", "templated":true}
            ],
            "ea:admin": [{
                "href": "http://a.com/admins/2",
                "title": "Fred"
            }, {
                "href": "http://a.com/admins/5",
                "title": "Kate"
            }]
        },
        "currentlyProcessing": 14,
        "shippedToday": 20,
        "_embedded": {
            "ea:order": [{
                "_links": {
                    "self": { "href": "http://a.com/orders/123" },
                    "ea:basket": { "href": "http://a.com/baskets/98712" },
                    "ea:customer": { "href": "http://a.com/customers/7809" }
                },
                "total": 30.00,
                "currency": "USD",
                "status": "shipped"
            }, {
                "_links": {
                    "self": { "href": "http://a.com/orders/124" },
                    "ea:basket": { "href": "http://a.com/baskets/97213" },
                    "ea:customer": { "href": "http://a.com/customers/12369" }
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
    fetchMock.mock('http://a.com/orders','GET', {
        body: 'plain'
        ,headers: {
            'content-type': 'text/plain'
        }
        ,status: 200
    })

    let sut = hal({
        self: 'http://a.com/orders'
        , fetch
    })
    return sut.get().catch((err) => {
        assert.equal(err.message,'illegal content type at http://a.com/orders : text/plain')
    })
    .then(fetchMock.restore.bind(fetchMock))

})
test('simple HEAD works',(assert) => {
    let self = { href: 'http://a.com/orders'}
    fetchMock.mock(self.href, 'HEAD', {
        headers: {
            'content-type': 'application/hal+json'
            , 'allow': 'GET,PUT,POST,DELETE'
        }
        ,status: 204
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
    let self = { href: 'http://a.com/orders'}
    fetchMock.mock(self.href, 'OPTIONS', {
        headers: {
            'content-type': 'application/hal+json'
            , 'allow': 'GET,PUT,POST,DELETE'
        }
        ,status: 200
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
        return accept === 'application/hal+json' && url === 'http://a.com/orders'
    }
    fetchMock.mock(matcher, 'GET', {
        body
        ,headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 200
    })

    let sut = hal({
        self: 'http://a.com/orders'
        , fetch
    })
    return sut.get().then((it) => {
        assert.equal(sut.currentlyProcessing,14)
    })
    .then(fetchMock.restore.bind(fetchMock))
})

test('GET with RFC6570 params works',(assert) => {
    let body = fullyLoaded()
    fetchMock.mock('http://a.com/orders?page=2&size=10', 'GET', {
        body
        ,headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 200
    })

    let sut = hal({
        self: 'http://a.com/orders{?page,size}'
        , fetch
    })
    return sut.get({page:2,size:10}).then((it) => {
        assert.equal(sut.currentlyProcessing,14)
    })
    .then(fetchMock.restore.bind(fetchMock))
})

test('GET with http errors dont fail',(assert) => {
    fetchMock.mock('http://a.com/orders', 'GET', {
        body: 'You suck'
        ,headers: {
            'content-type': 'text/plain'
        }
        ,status: 400
        , statusText: 'Bad Request'
    })

    let sut = hal({
        self: 'http://a.com/orders'
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
            url === 'http://a.com/orders' &&
            body === JSON.stringify({foo:'bar'})
    }
    fetchMock.mock(matcher, 'POST', {
        body: {}
        , headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 204
    })

    let sut = hal({
        self: 'http://a.com/orders'
        , fetch
    })
    return sut.post({foo:'bar'}).then(({response, resource}) => {
        assert.equal(response.statusText, 'No Content')
        assert.equal(resource.self,'http://a.com/orders')
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('POST resulting in location follows created entity',(assert) => {
    let body = fullyLoaded()
    let matcher = (url, opts) => {
        let {'content-type':contentType} = opts.headers
        let { body} = opts
        return contentType === 'application/hal+json' &&
            url === 'http://a.com/orders' &&
            body === JSON.stringify({foo:'bar'})
    }
    fetchMock.mock(matcher, 'POST', {
        headers: {
            'content-type': 'application/hal+json'
            , location: 'http://a.com/orders/1'
        }
        ,status: 201
    })
    fetchMock.mock('http://a.com/orders/1', 'GET', {
        body: {
            _links: { self: { href: 'http://a.com/orders/1' }}
            , bar: 'foo'
        }
        , headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 200
    })

    let sut = hal({
        self: 'http://a.com/orders'
        , fetch
    })
    return sut.post({foo:'bar'}).then(({resource}) => {
        assert.equal(resource.self,'http://a.com/orders/1')
        assert.equal(resource.bar,'foo')
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('DELETE works',(assert) => {
    fetchMock.mock('http://a.com/orders', 'DELETE', {
        headers: {
            'content-type': 'application/hal+json'
        }
        ,status: 204
    })

    let sut = hal({
        self: 'http://a.com/orders'
        , fetch
    })
    return sut.delete().then(({response, resource}) => {
        assert.equal(response.statusText,'No Content')
        assert.equal(resource.self,'http://a.com/orders')
    })
    .then(fetchMock.restore.bind(fetchMock))
})
test('PUT resulting sends full body and syncs',(assert) => {
    let self = { href: 'http://a.com/orders'}
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
    let self = { href: 'http://a.com/orders/1' }
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
