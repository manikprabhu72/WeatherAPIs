var forecast = function(name, date, temp, tempUnit, speed, direction, short) {
    var forecastModel = {        
        name: name,
        date: date,
        temperature: temp,
        temperatureUnit: tempUnit,
        windSpeed: speed,
        windDirection: direction,
        shortForecast: short,       
    };
    return forecastModel;
};

module.exports = forecast;