const express = require("express");
const app = express();
const forecastRoutes = require("./apiRoutes/forecastApi");

app.use("/forecast", forecastRoutes);

/*app.use((req, res, next) => {
    const error = new Error("Not found");
    error.status = 404;
    next(error);
  });
  */
  app.use((error, req, res, next) => {
    res.status(error.status || 500);
    if (req.headers['content-type'] == 'application/json') {
        res.json({
            error: {
              message: error.message
            }
          });
    }else{
        res.send("Error: "+error.message);
    }
    
  });

app.listen(8080,function () {
    console.log('Weather API server is running on port 8080');
});