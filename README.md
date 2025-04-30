## Notes  
I do not know who spammed from the web ide, I do not know how, they use up all my CPU and RAM on my VPS.  
Thanks to that guy, now all process have 60 second timeout from the server side, and are limited to 1 Core and 512 MB RAM.  
I don't know who you are, but I do have you IP address, and I now store all python codes in a compressed maner,  
Just in case anything goes wrong, I can still check how they managed to bypass the limit.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

fill in `config.json`, then run `pnpm build`
Run `docker build ./Docker --tag=python:3.9-ide`

After building, `pnpm start`
