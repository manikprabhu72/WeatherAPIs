# WeatherAPIs

Execution Steps:
1. npm install
2. Execute app.js file by the following command: node app.js

API Endpoints:

3 Days Forecast: 
http://localhost:8080/forecast/3days/{zipcode}

7 Days Forecast:
http://localhost:8080/forecast/7days/{zipcode}

App uses In Memory caching for the Third Party API responses using the NodeJS 'memory-cache' library
