const express = require("express");
const router = express.Router();
const request = require('request');
const forecast = require('../models/forecast.js');
const moment = require('moment');
const fs = require('fs-extra');
const cache = require('memory-cache');
//const zipCodeApi = 'https://private-portal.opendatasoft.com/api/records/1.0/search/?dataset=us-zip-code-latitude-and-longitude&lang=en&rows=1&facet=state&facet=timezone&facet=dst&refine.state=MA';
const gridApi = 'https://api.weather.gov/points/';
const forecastApi = 'https://api.weather.gov/gridpoints/';
const apiKey = '5a97314448e4efb1e69d82b98ce60c97eb941e6dc45ade9581b63357'; 
let memCache = new cache.Cache();
let cacheMiddleware = (duration) => {
        return (req, res, next) => {
            let key =  '__MyWeatherApp__' + req.originalUrl || req.url;
            let cacheContent = memCache.get(key);
            let forecasts;
            if(cacheContent){
                forecasts = cacheContent;                
            }
            next({
                forecasts: forecasts,
                duration: duration,
                key: key
            });            
        };
};
let zipCodeFunc = (cacheObj, req, res, next) => {   
    if(cacheObj.forecasts){
        console.log("From Cache with key: "+cacheObj.key);
        next(new Promise(function(resolve, reject){
            resolve(cacheObj.forecasts);
        }));
    }else{
        const zipCode = req.params.zipCode;
        if(!(/^\d{5}$/.test(zipCode))){
            const error = new Error("In Correct Zipcode");
            error.status = 404;
            if (req.headers['content-type'] == 'application/json') {
                res.status(422).json({
                    error: {
                        message: "InValid Zipcode"
                    }
                });
            } else {
            res.status(422).send("InValid zip code");
            }
        }else{ 
            let key = cacheObj.key;
            let duration = cacheObj.duration;
            async function readJsonFile(){
                try {
                    const myJsonObject = await fs.readJson('resources/zipcodes.json');
                    let lat, long;
                    myJsonObject.forEach(element => {                                  
                        if(element.fields.zip == zipCode){                                                                     
                            lat = element.fields.geopoint[0];
                            long = element.fields.geopoint[1];
                        }
                    })
                    if(!lat || !long){
                        throw new Error("Zipcode not Found");
                    }
                    return {
                        latitude: lat,
                        longitude: long
                    };                
                } catch (err) {
                    console.log(err);
                    throw new Error("Error Reading the file, try to run app.js from the root folder");
                }
            }                    
            let gridPromise = readJsonFile().then((records) => {
                return new Promise(function(resolve, reject){                    
                    let options = {
                        method: 'GET',
                        uri: gridApi+records.latitude+','+records.longitude,                            
                        headers: {          
                        'Content-type': 'application/json',  
                        'User-Agent': '(localhost, mcheekot@uncc.edu)'        
                        },                
                    };
                    request(options, function(err, response, body){    
                        if(err) return reject(err);
                        try { 
                            //console.log(body);  
                            let properties = JSON.parse(body).properties;
                            if(!properties || !("gridX" in properties) || !("gridY" in properties) || !("gridId" in properties) ) {
                                reject(new Error("Error in get Grid Points API"));
                            }            
                            resolve(properties);
                        } catch(e) {
                            reject(e);
                        }                 
                    });
                });
            });
            let forecastPromise = gridPromise.then((properties) => {
                return new Promise(function(resolve, reject){                    
                    let options = {
                        method: 'GET',
                        uri: forecastApi+properties.gridId+'/'+properties.gridX+','+properties.gridY+'/forecast',                            
                        headers: {          
                        'Content-type': 'application/json',
                        'User-Agent': '(localhost, mcheekot@uncc.edu)'          
                        },                
                    };
                    request(options, function(err, response, body){    
                        if(err) return reject(err);
                        try {   
                            let properties = JSON.parse(body).properties;
                            if(!properties || !("periods" in properties) || properties.periods.length === 0) {
                                reject(new Error("Error in get Grid Points API"));
                            }
                            memCache.put(key,properties.periods,duration*1000);            
                            resolve(properties.periods);
                        } catch(e) {
                            reject(e);
                        }                 
                    });
                });
            });    
            
            next(forecastPromise);        
        }
    }
    
};

let handleError = (error, req, res, next) => {
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
    
};

let displayForecast = (forecasts) => {
    let toString = [];
    forecasts.forEach(forecast => {
        toString.push(forecast.name+", "+forecast.date+": "+forecast.temperature+" "+forecast.temperatureUnit+", wind "+forecast.windSpeed+" "+forecast.windDirection+", "+forecast.shortForecast+"\n");
    })
    return toString;
}

router.get("/3days/:zipCode", cacheMiddleware(30), zipCodeFunc, (forecastPromise, req, res, next) => {   
    
        forecastPromise.then((periods) => {
            let forecasts = [] ;
            periods.forEach(period => {
                //let forecastDate = moment(period.startTime).format('MM/DD');
                forecasts.push(new forecast(period.name, period.startTime, period.temperature, period.temperatureUnit, period.windSpeed, period.windDirection, period.shortForecast));
            });            
            if (req.headers['content-type'] == 'application/json') {        
                res.status(200).json(forecasts.slice(0,6));
            } else {
                forecasts.map((forecast) => {
                    forecast.date = moment(forecast.date).format('MM/DD');
                })
                let forecastStr = displayForecast(forecasts.slice(0,6)).join("");
                res.setHeader('content-type', 'text/plain');
                res.status(200).send(forecastStr);
            }
        }).catch((err) => {
            console.log(err);
            next(err);
        });                        
    
}, handleError);

router.get("/7days/:zipCode", cacheMiddleware(30), zipCodeFunc, (forecastPromise, req, res, next) => {   
    
        forecastPromise.then((periods) => {
            let forecasts = [] ;
            periods.forEach(period => {
                //let forecastDate = moment(period.startTime).format('MM/DD');
                forecasts.push(new forecast(period.name, period.startTime, period.temperature, period.temperatureUnit, period.windSpeed, period.windDirection, period.shortForecast));
            });
            if (req.headers['content-type'] == 'application/json') {        
                res.status(200).json(forecasts);
            } else {
                forecasts.map((forecast) => {
                    forecast.date = moment(forecast.date).format('MM/DD');
                })
                let forecastStr = displayForecast(forecasts).join("");
                res.setHeader('content-type', 'text/plain');
                res.status(200).send(forecastStr);
            }
        }).catch((err) => {
            console.log(err);
            next(err);
        });                        
    
}, handleError);


module.exports = router;