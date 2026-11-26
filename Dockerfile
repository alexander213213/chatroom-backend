# Build: compile the Spring Boot jar (frontend is bundled from src/main/resources/static)
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src src
# contextLoads needs a live database, so only the unit test runs here
RUN ./mvnw -B -q package -Dtest=FileStorageServiceTest -Dsurefire.failIfNoSpecifiedTests=false

# Run
FROM eclipse-temurin:21-jre
RUN useradd --system --home /app app && mkdir -p /data && chown app /data
WORKDIR /app
COPY --from=build /src/target/chatroom-*.jar app.jar
COPY docker/entrypoint.sh entrypoint.sh
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh
USER app
EXPOSE 8081
ENTRYPOINT ["/app/entrypoint.sh"]
