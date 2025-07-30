import { AppRegistry, Button, Text, View } from 'react-native';

import usePushNotification from '@/hooks/usePushNotification';
import notifee, { AndroidImportance, AndroidStyle, AndroidVisibility, Event, Notification } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/app/utils/supabase';
import * as Clipboard from 'expo-clipboard';

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

function CustomComponent() {
  return (
    <View>
      <Text>A custom component</Text>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    AppRegistry.registerComponent('custom-component', () => CustomComponent);

    notifee.createChannel({
      id: 'messages',
      name: 'Firing alarms & timers',
      lights: false,
      vibration: true,
      'bypassDnd': true,
      importance: AndroidImportance.HIGH,
      'visibility': AndroidVisibility.PUBLIC,
      'sound': 'sound'
    });

    notifee.onBackgroundEvent(async (event: Event) => {
      
    })
    
  });
  async function onMessageReceived(message: Notification) {
    console.log('Message', message)
    if (!message || !message.data || !message.data.type) {
      return;
    }
    if (message.data.type === 'partial_notification') {
      // @ts-expect-error
      const notifeeData = JSON.parse(message.data.notifee || "");
      console.log(notifeeData)
      const data = notifeeData.body.data;
      // Assume data is in this format:
      // {
      //     "token": "123456",
      //     "data": {
      //         "type": "watch" | "danger" | "clear"
      //         "name": "earthquake" | "fire" | "drought"
      //         "temperature": 30,
      //         "humidity": 40,
      //         "water": 300,
      //         "light": 1000,
      //         "acceleration": 500
      //     }
      // }

      let title = '';
      let description = '';
      if (data.type === 'watch') {
        title = `${(data.name === 'fire' ? 'WILDFIRE RISK' : data.name).toUpperCase()} WATCH: `
        if (data.name === 'earthquake') {
          title += 'Stay Prepared for Potential Tremors'
          description = 'Be alert and ready to take cover. Keep emergency supplies within reach and stay tuned for further updates';
        } else if (data.name === 'fire') {
          title += 'High Wildfire Risk in Your Area'
          description = 'Avoid outdoor fires and be ready to evacuate. Keep fire safety measures in place.';
        } else if (data.name === 'drought') {
          title += 'Extreme Dry Conditions Detected'
          description = 'Conserve water and avoid outdoor burning. Be prepared for water restrictions and stay updated on local advisories.';
        }
      } else if (data.type === 'danger') {
        title = `${(data.name).toUpperCase()} DANGER: `
        if (data.name === 'earthquake') {
          title += 'Stay Prepared for Potential Tremors'
        } else if (data.name === 'fire') {
          title += 'Evacuate Nearby Forest Area Immediately!'
          description = 'A wildfire has been detected close to your location. Evacuate your home immediately and contact emergency services. Stay updated on evacuation routes and follow official guidance.';
        }
      } else {
        title = `CLEAR: `
        
        if (data.clear_type === 'watch') {
          title = `${(data.name === 'fire' ? 'Wildfire' : data.name).toUpperCase()} Watch No Longer In Effect`;
          description = ''
        } else if (data.clear_type === 'danger') {
          title = `${toTitleCase(data.name === 'fire' ? 'Wilfire' : data.name)} Danger No Longer Present`;
          description = ''
        } else {
          title = 'No Disasters Detected At This Time';
        }
      }

      await notifee.displayNotification({
        title:
          `<p style="color: #f3a55c;"><b>${title}</span></p></b></p> &#9888;`,
        body: description,
        android: {
          'channelId': 'messages',
          'importance': AndroidImportance.HIGH,
          'visibility': AndroidVisibility.PUBLIC,
          style: { type: AndroidStyle.BIGPICTURE, picture: 'https://my-cdn.com/user/123/upload/456.png' }
        },
      });
    }
  };

  useEffect(() => {
    messaging().setBackgroundMessageHandler(async function temp (message: Notification) {
      console.log('A new message arrived! (BACKGROUND)')
      await onMessageReceived(message);
    })
    messaging().onMessage(async function temp (message: Notification) {
      console.log('A new message arrived! (FOREGROUND)')
      await onMessageReceived(message);
    })
  }, []);

  const {
    requestUserPermission,
    getFCMToken,
    onNotificationOpenedAppFromBackground,
    onNotificationOpenedAppFromQuit,
  } = usePushNotification();

  const [token, setToken] = useState('');

  // Function to save token to your datastore/API
  const saveTokenToDatastore = useCallback(async (fcmToken: string) => {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .upsert(
          { 
            unique_device_id: 'test', 
            fcm_token: fcmToken 
          },
          { onConflict: 'unique_device_id' }
        )
        .select('*');
      
      if (error) {
        console.error('Error saving token to Supabase:', error);
      } else {
        console.log('Token saved successfully to Supabase:', data);
      }
    } catch (error) {
      console.error('Error saving token to datastore:', error);
    }
  }, []);

  // Bootstrap function to handle initial app setup
  const onAppBootstrap = useCallback(async () => {
    try {
      // Register the device with FCM
      await messaging().registerDeviceForRemoteMessages();
      
      // Get the token
      const fcmToken = await getFCMToken();
      setToken(fcmToken);
      
      // Save the token to your datastore
      await saveTokenToDatastore(fcmToken);
      
      // Set up other notification listeners
      requestUserPermission();
      onNotificationOpenedAppFromQuit();
      onNotificationOpenedAppFromBackground();
    } catch (error) {
      console.log('Error during app bootstrap:', error);
    }
  }, [getFCMToken, requestUserPermission, onNotificationOpenedAppFromQuit, onNotificationOpenedAppFromBackground, saveTokenToDatastore]);

  useEffect(() => {
    onAppBootstrap();

    // Listen for token refresh while app is open
    const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
      console.log('FCM Token refreshed:', newToken);
      setToken(newToken);
      await saveTokenToDatastore(newToken);
    });

    // Cleanup listener on unmount
    return unsubscribe;
  }, [onAppBootstrap, saveTokenToDatastore]);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(token);
  };

    const BASE_URL = 'https://notifications-api-ten.vercel.app'
    const handleSendNotification = async () => {
      console.log('setting notification')
      await fetch(`${BASE_URL}/notifications`, {
        method: 'POST',
        body: JSON.stringify({
          token,
        }),
        headers: {
          'Content-Type': 'application/json',
        }
      });
    };

  return (
    <View style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <Text>{`\n\n\n\n`}</Text>
      <Button title="tap this to copy token" onPress={copyToClipboard} />
      <Button title="tap this to reset token" onPress={() => messaging().deleteToken()} />
      <Button title="tap this for notification (5s delay)" onPress={handleSendNotification} />
    </View>
  );
}
