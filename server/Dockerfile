FROM golang:1.22-alpine

WORKDIR /app

# Required for some Go packages and potential CGO dependencies
RUN apk add --no-cache build-base

COPY . .

# Initialize modules and download dependencies
RUN go mod tidy
RUN go build -o main .

EXPOSE 8080

CMD ["./main"]
