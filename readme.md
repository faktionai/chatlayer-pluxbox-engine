# Marconi Chatlayer Connector Service

In this service we have utilised the following technologies:

- Express
- Typescript
- Prettier
- Docker

## Development environment setup

Install the dependencies and create an .env.local file.

> npm i
> cp .env .env.local
> npm run dev

## Building service code

To perform type checking and build the final application code

> npm run build

## Deployment

We have utilised docker to create an image for our service, this can be deployed manually or integrated in your own Continious Integration Pipeline.

> npm run build-ci

## Documentation

Chatlayer offers a free radio bot template and a Radiomanager micro service to support radio stations in speeding up the configuration and build time of their chatbots.
The radio bot template supports different intents and conversational flows to answer different questions from listeners. The micro service Radiomanager template is a middleware component between Chatlayer and Radiomanager to retrieve and present the Radiomanager data about shows, broadcasts, hosts in conversational flows.
Information about Chatlayer:
• https://docs.chatlayer.ai/
• https://chatlayer.ai

Information about Radio Manager:
• https://radiomanager.io
• https://pluxbox.com/documentation/swagger

Each HTTP API action plugin that sends a request to the Radio manager micro service has always three fixed request query parameters which are used by the service.
• varKey - the Chatlayer session variable where the results of the service will be stored. In this example this well be the show object with all information about the show.
• successfulDS – the dialog state where the user will be redirected to in the conversation when the service was able to successfully complete the request (finding the show info)
• notFoundDs – the dialog state where the user will be redirect to in the conversation when the service did not find the request info (the show in this example)
