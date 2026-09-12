# Embedding the estimate widget on the CCI Glass website

The widget is served by this application, not shipped as a script that runs
inside someone else's page. Give the web person one iframe.

## The snippet

```html
<iframe
  src="https://estimates.cciglass.com/estimate"
  title="Get a glass estimate"
  width="100%"
  height="640"
  style="border: 0; max-width: 34rem"
  allow="camera; clipboard-write"
  loading="lazy"
></iframe>
```

Swap the host for wherever this application is deployed. The path is
`/estimate`, which renders the widget on its own with no marketing chrome
around it.

## Why an iframe and not a script tag

`core/security/request-guard.ts` rejects any mutating request whose `Origin`
header does not match the `Host` it arrived at. That check is what stops a
third-party page from driving the intake API on a visitor's behalf.

A script embed injects the widget into the DOM of `cciglass.com`, so its
`fetch` calls carry `Origin: https://cciglass.com` while arriving at
`estimates.cciglass.com`. Every POST would be refused with `FORBIDDEN`.

Inside an iframe the document's own origin is the application's, so the same
requests are same-origin and pass. Nothing has to be relaxed to make the embed
work — which is the point. Loosening the origin check to allow a script embed
would remove the protection for every caller, not just the intended one.

## What `allow` covers

- `camera` lets the photo inputs open the camera directly on a phone. Without
  it, an iframed page falls back to the file picker, and a customer standing in
  front of broken glass has to hunt through their camera roll.
- `clipboard-write` lets the "Save your place" row copy the resume link.

## Requirements on the host page

The iframe must be allowed by the parent site's `Content-Security-Policy`. If
`cciglass.com` sets a `frame-src` directive, the application's origin has to be
added to it.

Nothing else is needed: no script, no stylesheet, no configuration on the host
page.

## Checking it works

Load the host page and confirm all three:

1. the widget renders and shows the opening message
2. entering name, phone and address advances the conversation — this is the
   step that fails if the origin check is rejecting requests
3. the photo buttons open the camera on a phone

If step 2 fails with "This request could not be verified", the widget is being
embedded as a script rather than an iframe, or a proxy in front of the
application is rewriting the `Host` header without rewriting `Origin`.
