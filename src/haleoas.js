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
.init(function({instance, stamp}){
    let body,links,embedded, allow = []
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
    const headerHandler = (method) => {
        return (response) => {
            let allows = response.headers.get('allow')
            if(allows) {
                this.allow(allows.split(','))
            }
            return response
        }
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

    const respond = (method) => {
        return (response) => {
            return {
                resource: this
                , response
            }
        }
    }

    const sync = (self) => {
        return haleoas({
            self
            , fetch: this.fetch
        }).get()
    }

    const stringifyReplacer = (key, value) => {
        if(key === '_links') {
            //do not include in serialization
            return undefined
        }
        return value
    }

    //api
    this.clone = () => stamp(instance)

    this.toJSON = function() {
        //properties (not methods) only
        let copy = Object.keys(this)
        .filter((key) => {
            return typeof this[key] !== 'function'
        })
        .reduce((obj,key)=> {
            obj[key] = this[key]
            return obj
        }, {})

        //reconstruct
        let result = copy
        ;(delete result.self)
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
    /**
     * what methods are ALLOWed?
     * getter/setter (Array) of HTTP methods
     * @return {Array} of HTTP methods retrieved by `ALLOW` response header
     * */
    this.allow = function(methods) {
        if(methods) { allow = methods }
        return allow
    }

    //http
    this.post = function(data = {}) {
        const url = this.self
        const req = {
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
                return sync(location)
            }
            return Promise.resolve(response)
            .then(bodyHandler(req.method))
            .then(headerHandler(req.method))
            .then(respond(req.method))
        })
    }

    this.put = function() {
        const url = this.self
        let serialized = this.toJSON()
        //dont include _links
        ;(delete serialized._links)
        const req = {
            credentials: 'include'
            , method: 'PUT'
            , headers: {
                'accept': MIME
                ,'content-type': 'application/json'
            }
            , body: JSON.stringify(serialized)
        }
        return this.fetch(url, req)
        .then(headerHandler(req.method))
        .then(sync.bind(this,this.self))
    }
    this.get = function(params) {
        let url = this.self
        if(params) {
            url  = this.expand(url,params)[0]
        }
        const req = {
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
        .then(bodyHandler(req.method))
        .then(headerHandler(req.method))
        .then(correctSelf)
        .then(respond(req.method))
    }

    /**
     * http://tools.ietf.org/html/rfc2616#section-9.7
     * */
    this.delete = function() {
        const url = this.self
        const req = {
            credentials: 'include'
            , method: 'DELETE'
            , headers: {
                'accept': MIME
                ,'content-type': MIME
            }
        }
        return this.fetch(url, req)
        .then(headerHandler(req.method))
        //@TODO handle 200
        //by parsing to a HAL status entity
        //and return that?
        .then(respond(req.method))
    }
    /**
     * http://tools.ietf.org/html/rfc6902
     * */
    this.patch  = function(to = {}) {
        const url = this.self
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
        .then(headerHandler(req.method))
        .then(sync.bind(this,this.self))
    }

    this.options = function() {
        let url = this.self
        let req = {
            credentials: 'include'
            , method: 'OPTIONS'
            , headers: {}
            , body: undefined
        }
        return this.fetch(url, req)
        .then(headerHandler(req.method))
        .then(respond(req.method))
    }
    this.head = function() {
        let url = this.self
        let req = {
            credentials: 'include'
            , method: 'HEAD'
            , headers: { }
            , body: undefined
        }
        return this.fetch(url, req)
        .then(headerHandler(req.method))
        .then(respond(req.method))
    }

    //preload
    if(this.body) {
        let copy = this.body
        ;(delete this.body)
        parse(copy)
        correctSelf()
    }
    if(this.self) {
        //add self link immediately
        links = { self: { href: this.self} }
    }

})
export default haleoas
