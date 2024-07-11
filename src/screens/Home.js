import { useContext, useState, useEffect } from "react";
import { StyleSheet, Text, View, ImageBackground, TouchableOpacity, Alert, Vibration, AppState } from "react-native";
const { EXPO_PUBLIC_OPEN_WEATHER_API_KEY } = process.env;

import { ThemeContext, UserContext } from "../context";
import { HomeHeader, TodaysWather, ForecastWeather, LoadingAnimation, LocationPermision, EditLocation, DisplayError } from "../components";
import getSavedWeatherData from "../utilities/GetSavedWeatherData";
import weatherCategories from "../utilities/WeatherCategories";
import weatherImages from "../utilities/WeatherImages";

export default function Home({ navigation }) {
  const [themeColors] = useContext(ThemeContext);
  const [userWeatherData, updateUserWeatherData] = useContext(UserContext);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const [isLoadingForecast, setIsLoadingForecast] = useState(true);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecastArray, setForecastArray] = useState([]);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(true);
  const [lastUpdatedTime, setlastUpdatedTime] = useState("Just Now");
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSearchingManually, setIsSearchingManually] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", _handleAppStateChange);

    syncUpdateTime();
    const intervalId = setInterval(() => {
      syncUpdateTime();
    }, 30000);

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [currentWeather]);

  const _handleAppStateChange = (nextAppState) => {
    if (nextAppState === "active") {
      //App came to the foreground
      if (currentWeather) {
        const minutesDifference = calculateMinutesDifference(
          currentWeather?.timeUpdated,
          new Date()
        );

        if (minutesDifference > 60) {
          fetchWeatherForecast({ latitude: currentWeather.latitude, longitude: currentWeather.longitude, placeName: currentWeather.placeName, silentRefresh: true });
        }
      }
    }
  };

  const syncUpdateTime = () => {
    if (currentWeather) {
      const minutesDifference = calculateMinutesDifference(currentWeather?.timeUpdated, new Date());

      let lastUpdateString = "";

      if (minutesDifference < 2) {
        lastUpdateString = "Just Now";
      } else if (minutesDifference > 2 && minutesDifference < 60) {
        lastUpdateString = `${parseInt(minutesDifference)} mins ago`;
      } else {
        const hoursDifference = minutesDifference / 60;
        if (hoursDifference < 24) {
          lastUpdateString = parseInt(hoursDifference) == 1 ? "an hour ago" : `${parseInt(hoursDifference)} hours ago`;
        } else {
          const dateUpdated = new Date(currentWeather?.timeUpdated);
          lastUpdateString = `${dateUpdated}`.substring(0, 21);
        }
      }

      setlastUpdatedTime(lastUpdateString);
    }
  };

  const calculateMinutesDifference = (timestamp1, timestamp2) => {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);

    // Calculate the time difference in milliseconds
    const timeDifference = date2 - date1;

    // Convert milliseconds to minutes (1 minute = 60,000 milliseconds)
    const minutesDifference = timeDifference / 60000;

    return minutesDifference;
  };

  const processCurrentWeatherData = (data) => {
    const { main, weather, name, latitude, longitude, searchQueryPlaceName } = data;
    const { temp, temp_min, temp_max } = main;
    const { main: weatherMain, description } = weather[0];

    const general = weatherCategories[weatherMain] || "unknown";
    const placeName = searchQueryPlaceName ? searchQueryPlaceName : name;

    const currentTemperature = Math.round(temp);
    const minTemperature = Math.round(temp_min);
    const maxTemperature = Math.round(temp_max);

    const timeUpdated = new Date();

    const weatherData = {
      general,
      main: weatherMain,
      description,
      placeName,
      currentTemperature,
      latitude,
      longitude,
      timeUpdated,
      minTemperature,
      maxTemperature,
    };

    setCurrentWeather(weatherData);
    setIsLoadingCurrent(false);
  };

  const processFiveDayWeatherForecast = (data) => {
    // Extract relevant data for the next 5 days
    const forecastList = data.list;
    const fiveDayForecast = [];

    // Get today's date and initialize a variable for the day of the week
    let currentDate = new Date();
    let currentDay = currentDate.getDay();
    const today = currentDay;

    // Define an array of day names for formatting
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    let minTemp;
    let maxTemp;
    for (const forecast of forecastList) {
      const date = new Date(forecast.dt * 1000); // Convert timestamp to date
      const dayOfWeek = dayNames[date.getDay()];

      if (date.getDay() === today) {
        //Do nothing and move to the next day
      } else if (date.getDay() !== currentDay) {
        // It's a new day, add the forecast to the result
        const dayForecast = forecast.weather[0].main;
        const weather = weatherCategories[dayForecast] || "unknown";

        const { temp } = forecast.main;
        minTemp = temp;
        maxTemp = temp;

        fiveDayForecast.push({
          day: dayOfWeek,
          weather,
          temperature: {
            temp_min: Math.round(minTemp),
            temp_max: Math.round(maxTemp),
          },
        });

        // Move to the next day
        currentDay = date.getDay();
      } else {
        //Basically, we loop through all the results of the same day
        //get the lowest and highest temperatures at different times of the day
        //and use the lowest as temp_min and the highest as temp_max

        const { temp } = forecast.main;
        minTemp = temp < minTemp ? temp : minTemp;
        maxTemp = temp > maxTemp ? temp : maxTemp;

        const lastPushedObjIndex = fiveDayForecast.length - 1;

        fiveDayForecast[lastPushedObjIndex].temperature = {
          temp_min: Math.round(minTemp),
          temp_max: Math.round(maxTemp),
        };
      }
    }

    setForecastArray(fiveDayForecast);
    setIsLoadingForecast(false);
  };

  const fetchWeatherForecast = async (data) => {
    const currentWeatherApiUrl = "https://api.openweathermap.org/data/2.5/weather";
    const forecastApiUrl = "https://api.openweathermap.org/data/2.5/forecast";

    const { latitude, longitude, placeName, silentRefresh } = data;

    try {
      if (!silentRefresh) {
        setIsLoadingCurrent(true);
        setIsLoadingForecast(true);
      }

      setIsFetchingLocation(false);
      setIsSearchingManually(false);

      //Fetch data for current weather
      const currentWeatherResponse = await fetch(`${currentWeatherApiUrl}?lat=${latitude}&lon=${longitude}&appid=${EXPO_PUBLIC_OPEN_WEATHER_API_KEY}&units=metric`);

      if (!currentWeatherResponse.ok) {
        setErrorMessage("Something went wrong fetching current weather data. Please try again later");
      }

      const currentWeatherData = await currentWeatherResponse.json();
      // console.log(`currentWeatherData:`, currentWeatherData);
      processCurrentWeatherData({ ...currentWeatherData, latitude, longitude, searchQueryPlaceName: placeName });

      //Fetch data for future weather forecast

      const forecastWeatherResponse = await fetch(`${forecastApiUrl}?lat=${latitude}&lon=${longitude}&appid=${EXPO_PUBLIC_OPEN_WEATHER_API_KEY}&units=metric`);

      if (!forecastWeatherResponse.ok) {
        setErrorMessage("Something went wrong fetching future forecast weather data. Please try again later");
      }

      const forecastWeatherData = await forecastWeatherResponse.json();
      processFiveDayWeatherForecast(forecastWeatherData);
      // console.log(`forecastWeatherData:`, forecastWeatherData);
    } catch (error) {
      getOfflineWeatherData(error.message);
    }
  };

  const getOfflineWeatherData = async (errorText) => {
    try {
      const savedData = await getSavedWeatherData();
      if (savedData) {
        const { today, forecast5Days } = savedData.currentLocationWeather;
        setForecastArray(forecast5Days);
        setCurrentWeather(today);
        setIsLoadingCurrent(false);
        setIsLoadingForecast(false);

        const errorTitle = errorText == "Network request failed" ? "No internet connection!" : "Something went wrong!";
        const errorBody = errorText == "Network request failed" ? "Please note that the displayed weather information may be outdated" : errorText;

        Alert.alert(errorTitle, errorBody, [{ text: "Noted", style: "cancel" }]);
        Vibration.vibrate();
      } else {
        setErrorMessage(errorText);
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const searchManually = () => {
    setIsFetchingLocation(false);
    setIsSearchingManually(true);
    setLocationModalVisible(true);
  };
  const cancelManualSearch = () => {
    setIsFetchingLocation(true);
    setIsSearchingManually(false);
  };

  if (errorMessage) {
    return (
      <DisplayError errorMessage={errorMessage} tryAgain={() => { setIsFetchingLocation(true); setErrorMessage(null); }} />
    );
  }
  if (isFetchingLocation) {
    return (
      <LocationPermision fetchWeatherForecast={fetchWeatherForecast} searchManually={searchManually} />
    );
  }
  if (isSearchingManually) {
    return (
      <View style={styles.container}>
        {locationModalVisible && (
          <EditLocation fetchWeatherForecast={fetchWeatherForecast} setLocationModalVisible={setLocationModalVisible} cancelManualSearch={cancelManualSearch} />
        )}
      </View>
    );
  }

  if (isLoadingCurrent || isLoadingForecast) {
    return <LoadingAnimation />;
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors[currentWeather.general] }]}
      onLayout={() => { updateUserWeatherData({ today: currentWeather, forecast5Days: forecastArray }) }} >
      <ImageBackground style={styles.currentWeatherContainer} source={weatherImages[currentWeather.general]} resizeMode="cover">
        <HomeHeader openDrawer={() => navigation.openDrawer()} placeName={currentWeather.placeName} setLocationModalVisible={setLocationModalVisible} />
        <Text style={styles.temperatureText}>
          {currentWeather.currentTemperature}°C
        </Text>
        <Text style={styles.weatherDescriptionText}>
          {currentWeather.description.toUpperCase()}
        </Text>
        <View style={[styles.lastUpdateContainer]}>
          <Text style={styles.lastUpdateText}>
            🕒 Last Updated {lastUpdatedTime}
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => { fetchWeatherForecast({ latitude: currentWeather.latitude, longitude: currentWeather.longitude, placeName: currentWeather.placeName, silentRefresh: false, }); }}>
            <Text style={styles.refreshText}>REFRESH</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
      <View style={styles.forecastContainer}>
        <TodaysWather currentWeather={currentWeather} />
        <ForecastWeather forecastArray={forecastArray} />
      </View>

      {locationModalVisible && (
        <EditLocation fetchWeatherForecast={fetchWeatherForecast} setLocationModalVisible={setLocationModalVisible} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#303030",
  },
  currentWeatherContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  forecastContainer: {
    flex: 1,
    width: "100%",
  },
  temperatureText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 55,
  },
  weatherDescriptionText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 30,
  },
  lastUpdateContainer: {
    backgroundColor: "rgba(163, 163, 163,0.4)",
    minHeight: "5%",
    minWidth: "30%",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    borderRadius: 7,
    marginTop: 5,
  },
  lastUpdateText: {
    color: "white",
    fontWeight: "700",
    marginVertical: 10,
  },
  refreshButton: {
    backgroundColor: "#303030",
    minHeight: 10,
    minWidth: 10,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    borderRadius: 5,
  },
  refreshText: {
    fontWeight: "bold",
    color: "white",
  },
});
