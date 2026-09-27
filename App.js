import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoadFindTV from "./loading";
import INTER from "./Interface";
import { TVConnectionProvider } from "./context/TVConnectionContext";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <TVConnectionProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: "#0a0a0f" },
          }}
        >
          <Stack.Screen name="LoadFindTV" component={LoadFindTV} />
          <Stack.Screen name="INTER" component={INTER} />
        </Stack.Navigator>
      </NavigationContainer>
    </TVConnectionProvider>
  );
}

