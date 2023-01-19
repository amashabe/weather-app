import React, { Component } from 'react';
import { View, Text, Platform, PermissionsAndroid, ActivityIndicator, Image } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

class App extends Component {
  state = {
    temperature: null,
    location: null
  }

  componentDidMount = async () => {
    if (Platform.OS !== 'android') {
      Geolocation.requestAuthorization();
    } else {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'we need GPS location service',
            message: 'we need location service to provide your location',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        )
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          this._getCurrentLocation();
        }
      }
      catch (err) {
        console.warn(err);
      }
    }
  }

  _getCurrentWeatherInfo = (latitude, longitude) => {
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=9e434c80334d27f34c578a4288dec5f4&units=metric`)
      .then(response => response.json())
      .then(json => {
        const location = json.name;
        const temperature = json.main.temp;
        this.setState({ location, temperature: Math.round(temperature) })
      })
      .catch(error => {
        console.error(error);
      });
  }

  _getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this._getCurrentWeatherInfo(latitude, longitude);
      },
      (error) => {
        console.log(error.code, error.message);
        this._getCurrentLocation();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }

  render() {
    const { state: { location, temperature } } = this;
    if (location && temperature) {
      return (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
            <Text style={{ fontSize: 25, fontWeight: "bold", color: "#000" }}>{location}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'center' }}>
            <Text style={{ fontSize: 25, fontWeight: "bold", color: "#000", paddingBottom: 20 }}>{temperature}C</Text>
            <Image source={require('./assets/sun_image.png')} style={{ width: 100, height: 100 }} />
          </View>
        </View>
      )
    }
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={'green'} size={50} />
      </View>
    )
  }
}

export default App;