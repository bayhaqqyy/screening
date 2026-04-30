FROM golang:1.22-alpine

WORKDIR /app

# Fix network issues (DNS/IPv6) by disabling sumDB and setting proxy
ENV GOSUMDB=off
ENV GOPROXY=https://proxy.golang.org,direct
ENV CGO_ENABLED=0

COPY . .

# Initialize modules and download dependencies
RUN go mod tidy
RUN go build -o main .

EXPOSE 8080

CMD ["./main"]
