'use strict';

import test from 'blue-tape'
import haleoas from '../src/haleoas.js'
import bluebird from 'bluebird';

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
test('expanding link on proto works', (assert) => {
    let simple = haleoas().expand('/a{?foo}',{foo:1})
    let multi = haleoas().expand('/a{?foo}',[{foo:1},{foo:2}])
    assert.equal(simple[0],'/a?foo=1')
    assert.equal(multi[0],'/a?foo=1')
    assert.equal(multi[1],'/a?foo=2')
    assert.end()
})
test('expanding link on resource works without template',(assert) => {
    let lnk = {
        href: '/a',
        templated: false
    }
    let sut = hal({ selfLink: lnk })
    let result = sut.expand(lnk, { foo: 1, bar: 2 });
    assert.deepEqual(result, ['/a?foo=1&bar=2']);
    assert.end()
})
test('expanding link with search on resource works without template',(assert) => {
    let lnk = {
        href: '/a?baz=x',
        templated: false
    }
    let sut = hal({ selfLink: lnk })
    let result = sut.expand(lnk, { foo: 1, bar: 2 });
    assert.deepEqual(result, ['/a?baz=x&foo=1&bar=2']);
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
test('providing Promise impl works', (assert) => {
    let body = fullyLoaded()
    let sut = hal({ Promise: bluebird })
    sut.parse(body)
    return sut.follow('ea:find')
    .tap( () => {
        assert.pass('non-standard,bluebird TAP fn was used');
    } )
})


