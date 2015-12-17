'use strict';

import test from 'blue-tape'
import hal from '../src/haleoas.js'
import fetchMock from 'fetch-mock'
import deepEqual from 'deep-equal'
import 'isomorphic-fetch'

const A = () => {
    let self = 'http://a.com/a'
    let body =  {
        _links: {
            self: { href: self }
            , 'co:b': { href: 'http://a.com/b'}
        }
        , name: 'A'
    }
    return { self , body }
}

const B = () => {
    let self= 'http://a.com/b'
    let body =  {
        _links: {
            self: { href: self }
            , 'co:a': { href: 'http://a.com/a'}
        }
        , name: 'B'
    }
    return { self , body }
}
test('following a single relationship works',(assert) => {
    let res1 = A()
    let res2 = B()
    fetchMock.mock(res1.self,'GET',{
        body: res1.body
        , headers: { 'content-type':'application/hal+json' }
    })
    fetchMock.mock(res2.self,'GET',{
        body: res2.body
        , headers: { 'content-type':'application/hal+json' }
    })
    let sut = hal({self: res1.self, fetch})
    return sut.get()
    .then(sut.follow.bind(sut,'co:b'))
    .then((results) => {
        assert.equal(results[0].resource.self,res2.self)
    })
})


