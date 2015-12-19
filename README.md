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

### Running tests

**NodeJS**
`npm test`

**Browser**

`npm serve`

In your browser, visit `http://localhost:3000/test-runner.html` and look in the console.



