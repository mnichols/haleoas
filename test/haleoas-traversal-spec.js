'use strict';

import test from 'blue-tape'
import haleoas from '../src/haleoas.js'
import fetchMock from 'fetch-mock'
import deepEqual from 'deep-equal'
import 'isomorphic-fetch'

const hal = haleoas()

const getOrigin = () => {
    if(typeof window !== 'undefined' ) { return window.location.origin}
    return 'http://example.com'
}
const origin = getOrigin()
const A = () => {
    let self = `${origin}/a`
    let body =  {
        _links: {
            self: { href: self }
            , 'co:b': { href: `${origin}/b`}
        }
        , name: 'A'
    }
    return { self , body }
}

const B = () => {
    let self= `${origin}/b`
    let body =  {
        _links: {
            self: { href: self }
            , 'co:a': { href: `${origin}/a`}
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
        , headers: {
            'content-type':'application/hal+json'
            , 'content-length': JSON.stringify(res1.body).length
        }
    })
    fetchMock.mock(res2.self,'GET',{
        body: res2.body
        , headers: {
            'content-type':'application/hal+json'
            , 'content-length': JSON.stringify(res2.body).length
        }
    })
    let sut = hal({self: res1.self, fetch})
    return sut.get()
    .then(sut.follow.bind(sut,'co:b'))
    .then((results) => {
        assert.equal(results[0].self,res2.self)
    })
})


