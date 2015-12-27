'use strict';

import stampit from 'stampit'
import urlTemplate from 'url-template'
import diff from 'json-patch-gen'

/**
 * factory for a resource
 * @param {Function} fetch the xhr implementation for http. Prefer the [fetch api](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
 * @param {Url} [self] the resource uri
 * @param {Object} [body] a valid `HAL` representation to seed the resource with
 * @param {Promise} [Promise] a Promise implementation conforming to [this](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)
 * */
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
    const isBodyCandidate = (response) => {
        let status = response.status
        return (status > 199 && (status !== 204 && status !== 304))
    }
    /**
     * eg http://www.w3.org/Protocols/rfc2616/rfc2616-sec4.html#sec4.4
     * @TODO handle `transfer-encoding` header?
     * **/
    const bodyHandler = (method) => {
        return (response) => {
            if(!isBodyCandidate(response)) {
                return response
            }
            let contentType = response.headers.get('content-type')
            let contentLength = response.headers.get('content-length')
            if(contentType !== MIME) {
                let errorMessage = `illegal content type at ${response.url} : ${contentType}`
                this.logerror(errorMessage)
                return response
            }
            //missing header returns `null`
            if(contentLength != null && contentLength < 1) {
                return response
            }
            try {
                return response.json()
                .then(parse)
                .then(() => {
                    return response
                })
                .catch((err)=> {
                    this.logerror(err)
                    return response
                })
            } catch(err) {
                this.logerror(err)
                return response
            }
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
    /**
     * Clone this resource
     * */
    this.clone = () => stamp(instance)

    /**
     * serialize this resource to JSON.
     * Optionally include `{ _links: false }` or `{ _embedded: false }`
     * to suppress the inclusion of these attributes in the result.
     * They both default to `true`.
     * */
    this.toJSON = function({_links,_embedded} = {}) {
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
        if(typeof _links === 'undefined' || !!_links ) {
            result._links = Object.assign({},links)
        }
        if(typeof _embedded === 'undefined' || !!_embedded ) {
            result._embedded = Object.assign({},embedded)
        }
        return result
    }
    /**
     * parse a JSON object to hydrate this instance
     * */
    this.parse = function(_body){
        parse(_body)
        return this
    }
    /**
     * Expand a url conforming to http://tools.ietf.org/html/rfc6570
     * with the params
     * @param {Url} url http://tools.ietf.org/html/rfc6570
     * @param {Object} params parameters to expand in the url
     * @return {Url} the expanded url
     * */
    this.expand = function(link, params) {
        //only arrays
        params = [].concat(params)
        let exp = urlTemplate.parse(link.href || link)
        return params.map((q)=> {
            return exp.expand(q ||{})
        })
    }
    /**
     * @param {String} rel retrieve the list of links by relationship
     * @return {Array} of matching relationships from `_links` collection
     * An empty array is returned if the relationship doesn't exist.
     * */
    this.links = function(rel) {
        let matches = (links || {})[rel]
        if(!matches) { return [] }
        let result = [].concat(matches)
        return result
    }
    /**
     * what methods are ALLOWed?
     * getter/setter (Array) of HTTP methods
     * @param {Array} [methods] Array of valid method names
     * @return {Array} of HTTP methods retrieved by `ALLOW` response header
     * */
    this.allow = function(methods) {
        if(methods) { allow = methods }
        return allow
    }

    /**
     * Follows the relation(s) at `rel`
     * @param {String} rel The relationship to traverse
     * @return {Promise} resolving an Array of {haleoas} instances
     * for each link, but _have not_ been synced with server.
     * **/
    this.follow = function(rel) {
        let lnks = this.links(rel)
        if(!lnks.length) {
            throw new Error(`${this.self} not related with '${rel}'`)
        }
        //allow non-global Promise
        let P = (this.Promise || Promise)
        let promises = lnks.map((lnk) => {
            return haleoas({ self: lnk.href, fetch: this.fetch })
        })
        return P.all(promises)
    }

    //http api
    /**
     * Issues a `POST` request against this resource
     * Follows up with a `GET` right away if a `Location` header is present, as in
     * a `201 Created` response.
     * @param {Object} data optional body content to send
     * @return {Promise} the {resource,response} object of either the new resource
     * (when a `Location` header is present in response) or the current instance.
     * **/
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
            //allow non-global Promise
            let P = (this.Promise || Promise)
            return P.resolve(response)
            .then(bodyHandler(req.method))
            .then(headerHandler(req.method))
            .then(respond(req.method))
        })
    }

    /**
     * Issues a `PUT` request against this resource
     * Follows up with a `GET` right away to resync this resource.
     * @return {Promise} resolving to a {request,response} object for a new instance of this resource
     * **/
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
    /**
     * @param {Object} [params] optionally provide params for `self` having a url
     * templated in conformance to [RFC6570](http://tools.ietf.org/html/rfc6570).
     * @return {Promise} resolving an object having the `Response` and this instance (`resource`)
     * , but hydrated with payload from response
     * **Note** that `content-type` other than `application/hal+json` will not throw an error
     * and this instance will remain untouched.
     **/
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
     * Issues a `DELETE` request against this resource
     * http://tools.ietf.org/html/rfc2616#section-9.7
     * @return {Promise} the {resource,response} object of this resource
     * **/
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
     * Issues a `PATCH` request against this resource
     * http://tools.ietf.org/html/rfc6902
     * @param {Object} [to] optionally pass the patch data to use for diff
     * When this argument is included, it will diff the current state of the
     * resource against that patch shape.
     * Otherwise, it will diff against the _original_ body and the current state
     * of the resource.
     * It will immediately issue an `GET` request to resync from the server.
     * @return {Promise} resolving to a {request,response} object for a new instance of this resource
     * */
    this.patch  = function(to) {
        const url = this.self
        let serialized = this.toJSON({ _links: false, _embedded: false})
        let dest = (to || serialized)
        let src = (to ? serialized : body)
        let patch = diff( src, dest )

        let req = {
            credentials: 'include'
            , method: 'PATCH'
            , headers: {
                'accept': MIME
                ,'content-type': 'application/json-patch+json'
                , 'version': 'http/1.1'
            }
            , body: patch
            , mode: 'cors'
        }
        return this.fetch(url, req)
        .then(headerHandler(req.method))
        .then(sync.bind(this,this.self))
    }

    /**
     * Issues a `OPTIONS` request against this resource
     * @return {Promise} resolving an object having the `Response` and this instance (`resource`)
     **/
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
    /**
     * Issues a `HEAD` request against this resource
     * @return {Promise} resolving an object having the `Response` and this instance (`resource`)
     **/
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
    } else if(this.self) {
        //add self link immediately
        links = { self: { href: this.self} }
    }

})
export default haleoas
