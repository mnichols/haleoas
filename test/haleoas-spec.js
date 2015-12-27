'use strict';

import test from 'blue-tape'
import haleoas from '../src/haleoas.js'
const hal = haleoas()

const fullyLoaded = () => {
    return {
        "_links": {
            "self": { "href": "/orders" },
            "curies": [{ "name": "ea", "href": "http://example.com/docs/rels/{rel}", "templated": true }],
            "next": { "href": "/orders?page=2" },
            "ea:find": {
                "href": "/orders{?id}",
                "templated": true
            },
            "ea:multi": [
                { "href": "/a{?foo}", "templated":true},
                { "href": "/b{?foo}", "templated":true},
                { "href": "/c{?foo}", "templated":true}
            ],
            "ea:admin": [{
                "href": "/admins/2",
                "title": "Fred"
            }, {
                "href": "/admins/5",
                "title": "Kate"
            }]
        },
        "currentlyProcessing": 14,
        "shippedToday": 20,
        "_embedded": {
            "ea:order": [{
                "_links": {
                    "self": { "href": "/orders/123" },
                    "ea:basket": { "href": "/baskets/98712" },
                    "ea:customer": { "href": "/customers/7809" }
                },
                "total": 30.00,
                "currency": "USD",
                "status": "shipped"
            }, {
                "_links": {
                    "self": { "href": "/orders/124" },
                    "ea:basket": { "href": "/baskets/97213" },
                    "ea:customer": { "href": "/customers/12369" }
                },
                "total": 20.00,
                "currency": "USD",
                "status": "processing"
            }]
        }
    }
}
test('parsing complex hal object works', (assert) => {
    let body = fullyLoaded()
    let sut = hal()
    sut.parse(body)
    assert.equal(sut.links('self')[0].href,'/orders')
    assert.equal(sut.shippedToday, 20)
    assert.equal(sut.currentlyProcessing, 14)
    assert.equal(sut.links('next').length,1)
    assert.end()
})
test('expanding link works',(assert) => {
    let sut = hal()
    let simple = sut.expand('/a{?foo}',{foo:1})
    let multi = sut.expand('/a{?foo}',[{foo:1},{foo:2}])
    assert.equal(simple[0],'/a?foo=1')
    assert.equal(multi[0],'/a?foo=1')
    assert.equal(multi[1],'/a?foo=2')
    assert.end()
})
test('body is supported in initialization',(assert) => {
    let body = {
        "_links": {
            "self": { "href": "http://localhost:8000" },
            "about": { "href": "http://localhost:8000/about" }
        },
        "foo": "bar"
    }
    let res = hal({ self: "http://localhost:8000", body })
    assert.equal(res.links('about').length, 1)
    assert.end()
})


