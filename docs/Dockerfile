FROM ruby:3.3-alpine

RUN apk add --no-cache build-base

COPY Gemfile /bundle/Gemfile
WORKDIR /bundle
RUN bundle install
ENV BUNDLE_GEMFILE=/bundle/Gemfile

WORKDIR /site
EXPOSE 4000

ENTRYPOINT ["jekyll", "serve", "--source", "/site", "--destination", "/tmp/_site", "--host", "0.0.0.0", "--force_polling"]
