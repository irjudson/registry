# Registry

The registry service provides identity and discovery services for security principals in Nitrogen (devices, applications, and users).

## Installation

1. `git clone https://github.com/nitrogenjs/registry`
2. `cd registry`
3. `npm install`
4. `node server.js`

## How to contribute

1.  Feedback:  We'd love feedback on what problems you are using Nitrogen to solve.  Obviously, we'd also like to hear about where you ran into sharp edges and dead ends.   Let us know by filing an issue with the project.
2.  Pull requests:  If you'd like to tackle an issue, fork the repo, create a clean commit for the fix or enhancement (with tests if new ones are required), and send us a pull request.

## Nitrogen Project

The Nitrogen project is housed in a set of GitHub projects:

1. [registry](https://github.com/nitrogenjs/registry): Device identity and discovery services.
2. [ingestion](https://github.com/nitrogenjs/ingestion): Message ingestion services.
3. [consumption](https://github.com/nitrogenjs/consumption): Message query and realtime consumption services.
4. [client](https://github.com/nitrogenjs/client): JavaScript client library for building Nitrogen devices and applications.
5. [admin](https://github.com/nitrogenjs/admin): Web admin tool for working with the Nitrogen service.
6. [device](https://github.com/nitrogenjs/devices): Device principals for common pieces of hardware.
7. [commands](https://github.com/nitrogenjs/commands): CommandManagers and schemas for well known command types.
8. [cli](https://github.com/nitrogenjs/cli): Command line interface for working with the Nitrogen service.
9. [reactor](https://github.com/nitrogenjs/reactor): Always-on hosted application execution platform.
10. [apps](https://github.com/nitrogenjs/apps): Project maintained Nitrogen applications.
11. [frontdoor](https://github.com/nitrogenjs/frontdoor): Frontdoor proxy for API consolidation between backends.