FROM postgres:17-alpine
USER root
RUN mkdir -p /data && chown postgres:postgres /data
ENV PGDATA=/data/postgres
USER postgres
