import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DrawerNavigation from "./DrawerNavigation";
import SavedLocations from "../screens/SavedLocations";

const Stack = createNativeStackNavigator();

function Navigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="DrawerNavigation" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="DrawerNavigation" component={DrawerNavigation} />
        <Stack.Screen name="SavedLocations" component={SavedLocations} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default Navigator;
