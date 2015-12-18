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


