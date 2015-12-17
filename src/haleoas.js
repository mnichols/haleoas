'use strict';

import stampit from 'stampit'
import urlTemplate from 'url-template'
import diff from 'json-patch-gen'

const link = stampit()
.props({
    href: ''
    , templated: ''
    , type: ''
    , deprecation: ''
    , name: ''
    , profile: ''
    , title: ''
    , hreflang: ''
})
.init(function(){
    if(!this.href) {
        throw new Error('href is required for link objects')
    }

})

const haleoas = stampit()
.init(function(){
    let body,links,embedded
    this.logerror = (this.logerror || this.log || console.error.bind(console))
    this.log = (this.log || console.log.bind(console))

    const MIME = 'application/hal+json'

    const correctSelf = (ignore) => {
        let linkSelf = this.links('self')
        if(linkSelf && linkSelf[0]) {
            this.self = linkSelf[0].href
        }
        return ignore
    }
    const parse = (json = {}) => {
        let copy = Object.assign({},json)
        ;({_links:links,_embedded:embedded} = copy)
        ;(delete copy._links)
        ;(delete copy._embedded)
        body = copy
        //merge body values onto `this`
        Object.assign(this,copy)
        return json
    }
    const bodyHandler = (method) => {
        return (response) => {
            let contentType = response.headers.get('content-type')
            if(contentType !== MIME) {
                let errorMessage = `illegal content type at ${response.url} : ${contentType}`
                this.logerror(errorMessage)
                return response
            }
            return response.json()
            .then(parse)
            .then(()=> {
                return response
            })
        }
    }

    //api
    this.toJSON = function() {
        //reconstruct
        let result = Object.assign({},body)
        result._links = Object.assign({},links)
        result._embedded = Object.assign({},embedded)
        return result
    }
    this.parse = function(_body){
        parse(_body)
        return this
    }
    /**
     * http://tools.ietf.org/html/rfc6570
     * */
    this.expand = function(link, params) {
        //only arrays
        params = [].concat(params)
        let exp = urlTemplate.parse(link.href || link)
        return params.map((q)=> {
            return exp.expand(q ||{})
        })
    }
    this.links = function(rel) {
        let matches = (links || {})[rel]
        if(!matches) { return [] }
        let result = [].concat(matches)
        return result
    }
    this.post = function(data = {}) {
        let url = this.self
        let req = {
            credentials: 'include'
            , method: 'POST'
            , headers: {
                'accept': MIME
                ,'content-type': MIME
            }
            , body: JSON.stringify(data)
        }
        return this.fetch(url, req)
        .then((response) => {
            let location = response.headers.get('location')
            if(location) {
                return haleoas({
                    self: location
                    , fetch: this.fetch
                }).get()
            }
            return Promise.resolve(response)
            .then(bodyHandler('POST'))
            .then((response)=> {
                return {
                    resource: this
                    , response
                }
            })
        })
    }

    this.get = function(params) {
        let url = this.self
        if(params) {
            url  = this.expand(url,params)[0]
        }
        let req = {
            credentials: 'include'
            , method: 'GET'
            , headers: {
                'accept': MIME
                ,'content-type': MIME
            }
            //https://groups.yahoo.com/neo/groups/rest-discuss/conversations/messages/9962
            , body: undefined
        }
        return this.fetch(url, req)
        .then(bodyHandler('GET'))
        .then(correctSelf)
        .then((response) => {
            return {
                resource: this
                , response
            }
        })
    }

    /**
     * http://tools.ietf.org/html/rfc2616#section-9.7
     * */
    this.delete = function() {
        let url = this.self
        let req = {
            credentials: 'include'
            , method: 'DELETE'
            , headers: {
                'accept': MIME
                ,'content-type': MIME
            }
        }
        return this.fetch(url, req)
        //@TODO handle 200
        //by parsing to a HAL status entity
        //and return that?
        .then((response) => {
            return {
                resource: this
                , response
            }
        })
    }
    /**
     * http://tools.ietf.org/html/rfc6902
     * */
    this.patch  = function(to = {}) {
        let url = this.self
        let patch = diff(body || {},to)
        let req = {
            credentials: 'include'
            , method: 'PATCH'
            , headers: {
                'accept': MIME
                ,'content-type': 'application/json-patch+json'
            }
            , body: patch
        }
        return this.fetch(url, req)
        .then(this.get.bind(this))
    }

    //preload
    if(this.body) {
        parse(this.body)
        correctSelf()
    }
    if(this.self) {
        //add self link immediately
        links = { self: { href: this.self} }
    }

})
export default haleoas
