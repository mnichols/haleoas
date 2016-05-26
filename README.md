# HALEOAS

## HAL Hypermedia REST Client


Supported HTTP Methods:

* `GET` : supports url templating params using [RFC6570](http://tools.ietf.org/html/rfc6570)
* `HEAD`
* `OPTIONS`
* `PUT` : sends everything except `_link` as `content-type: application/json`
* `POST`
* `PATCH` : conforms to [RFC6902](http://tools.ietf.org/html/rfc6902) and sends `content-type:application/json-patch+json`
* `DELETE`


### Browser support

When running browser tests, a modern web server is expected ^1.1.

* Safari borks by babel-core because of [this silliness](https://github.com/thlorenz/convert-source-map/issues/31)

### Size

- **unminified** ~3.8kb
- **minified** ~1.4kb

### Running tests

**NodeJS**
`npm test`

**Browser**

`npm serve`

In your browser, visit `http://localhost:3000/test-runner.html` and look in the console.



### Usage

#### GET

```js
import haleoas from ‘haleoas’
let hal = haleoas({ fetch: myFetchImpl })
let resource = hal({ self: ‘http://my.api.com{?foo’})
/**
 * GET /?foo=bar HTTP/1.1
 * Host: http://my.api.com
 * Accept: application/hal+json
**/
resource.get({ foo: ‘bar’, fetch: globalFetch }).then({ resource, response }) => {
    //the resource, mapped to the HAL body and ready for traversal
    //the response, whatever is returned from `fetch`
})
```

#### POST

```js
import haleoas from ‘haleoas’
let hal = haleoas({ fetch: myFetchImpl })
let resource = hal({ self: ‘http://my.api.com’})
/**
 * POST / HTTP/1.1
 * Host: http://my.api.com
 * Content-Type: application/json
 * Accept: application/hal+json
 * 
 * {
 *  “foo”: “bar”
 * }
**/
resource.post({ foo: ‘bar’, fetch: globalFetch }).then({ resource, response }) => {
    //the resource, mapped to the HAL body and ready for traversal
    // or, if a 201 with a `location` is returned, the new entity is returned
    //the response, whatever is returned from `fetch`
})
```

#### DELETE

```js
import haleoas from ‘haleoas’
let hal = haleoas({ fetch: myFetchImpl })
let resource = hal({ self: ‘http://my.api.com’})
/**
 * DELETE / HTTP/1.1
 * Host: http://my.api.com
 * Accept: application/hal+json
**/
resource.delete().then({ resource, response }) => {
    //the resource, mapped to the HAL body and ready for traversal
    //the response, whatever is returned from `fetch`
})
```

#### PATCH

```js
import haleoas from ‘haleoas’
let hal = haleoas({ fetch: myFetchImpl })
let resource = hal({ self: ‘http://my.api.com’})
/**
 * PATCH / HTTP/1.1
 * Host: http://my.api.com
 * Accept: application/hal+json
 * Content-Type: application/json-patch+json
 *
 * [
 *   {
 *     “op”:“add”,
 *     “path”: “/foo”,
 *     “value”: “bar”
 *   }
 *]
**/
resource.patch({foo:bar}).then({ resource, response }) => {
    //the resource, mapped to the HAL body and ready for traversal
    //the response, whatever is returned from `fetch`
})
```
