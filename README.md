# HALEOAS
## HAL Hypermedia REST Client


Supported HTTP Methods:

* `GET`
* `HEAD`
* `OPTIONS`
* `PUT` : sends everything except `_link` as `content-type: application/json`
* `POST`
* `PATCH` : conforms to **http://tools.ietf.org/html/rfc6902** and sends `content-type:application/json-patch+json`
* `DELETE`
