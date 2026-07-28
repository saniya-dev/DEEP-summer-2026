import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Animated,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Alert,
} from "react-native";
import { BleManager, Device, State } from "react-native-ble-plx";
import { styles } from "../constants/styles";

// BLE Heart Rate Service & Characteristic UUIDs (Bluetooth SIG standard)
const HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_CHARACTERISTIC_UUID = "00002a37-0000-1000-8000-00805f9b34fb";

// ─── Singleton BLE manager ────────────────────────────────────────────────────
const bleManager = new BleManager();

// ─── Parse Heart Rate Measurement characteristic (BT SIG spec) ───────────────
function parseHeartRate(base64Value: string) {
  const raw = atob(base64Value);
  const bytes = Array.from(raw).map((c) => c.charCodeAt(0));
  const seqNum = bytes[0];
  const hr = bytes[1];
  const rrIntervals = [];
  let offset = 2;
  const rrPresent = false;
  if (rrPresent) {
    while (offset + 1 < bytes.length) {
      const rr = ((bytes[offset + 1] << 8) | bytes[offset]) / 1024;
      rrIntervals.push(Math.round(rr * 1000));
      offset += 2;
    }
  }
  return { seqNum, heartRate: hr, rrIntervals };
}

// ─── Pulse animation component ───────────────────────────────────────────────
function PulseRing({ bpm }: { bpm: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!bpm || bpm <= 0) return;
    const interval = (60 / bpm) * 1000;
    const pulse = Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.35,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    ]);
    const loop = setInterval(() => pulse.start(), interval);
    return () => clearInterval(loop);
  }, [bpm]);

  return (
    <Animated.View
      style={[styles.pulseRing, { transform: [{ scale }], opacity }]}
    />
  );
}

// ─── BPM Gauge ────────────────────────────────────────────────────────────────
function BpmGauge({ bpm }: { bpm: number }) {
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!bpm) return;
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bpm]);

  const zone =
    bpm < 60
      ? "#4fc3f7"
      : bpm < 100
        ? "#a5d6a7"
        : bpm < 140
          ? "#fff176"
          : "#ef9a9a";
  const zoneLabel =
    bpm < 60
      ? "RESTING"
      : bpm < 100
        ? "NORMAL"
        : bpm < 140
          ? "ELEVATED"
          : "HIGH";

  return (
    <View style={styles.gaugeContainer}>
      <PulseRing bpm={bpm} />
      <Animated.View
        style={[styles.heartIcon, { transform: [{ scale: heartScale }] }]}
      >
        <Text style={[styles.heartEmoji]}>♥</Text>
      </Animated.View>
      <Text style={[styles.bpmValue, { color: zone }]}>{bpm ?? "--"}</Text>
      <Text style={styles.bpmUnit}>BPM</Text>
      {bpm != null && (
        <View style={[styles.zoneBadge, { borderColor: zone }]}>
          <Text style={[styles.zoneText, { color: zone }]}>{zoneLabel}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Device row ───────────────────────────────────────────────────────────────
function DeviceRow({
  device,
  onPress,
  isConnecting,
}: {
  device: Device;
  onPress: (device: Device) => void;
  isConnecting: boolean;
}) {
  const rssiBar = Math.max(0, Math.min(100, (device.rssi ?? 0 + 100) * 2));
  return (
    <TouchableOpacity
      style={styles.deviceRow}
      onPress={() => onPress(device)}
      activeOpacity={0.75}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {device.name || "Unknown Device"}
        </Text>
        <Text style={styles.deviceId} numberOfLines={1}>
          {device.id}
        </Text>
        <View style={styles.rssiRow}>
          <View style={styles.rssiTrack}>
            <View style={[styles.rssiBar, { width: `${rssiBar}%` }]} />
          </View>
          <Text style={styles.rssiText}>{device.rssi} dBm</Text>
        </View>
      </View>
      {isConnecting ? (
        <ActivityIndicator color="#ef5350" size="small" />
      ) : (
        <Text style={styles.connectArrow}>›</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const subscription = useRef<any>(null);
  const scanTimeout = useRef<any>(null);
  const [bleState, setBleState] = useState("Unknown");
  const [scanning, setScanning] = useState(false);

  // Create our state objects
  // TODO: create a state called devices and set it to an empty array. The type should be a device array (i.e. Device[])
  // TODO: create a state called connectedDevice and set it to null. It will either be a Device or null.
  // TODO: create a state called connectingId and set it to null. It will either be a string or null.
  // TODO: create a state called heartRate and set it to 0
  // TODO: create a state called rrIntervals and set it to an empty array. The type should be a number array
  // TODO: create a state called log and set it to an empty array. The type should be a string array
  // TODO: create a state called prevSeqNum and set it to -1.
  // TODO: create a state called seqNum and set it to 0.

  // TODO: uncomment the following function after you made the log state.
  // const addLog = useCallback((msg: string) => {
  //   setLog((prev) => [msg, ...prev].slice(0, 50));
  // }, []);

  // Monitor BLE state
  useEffect(() => {
    const sub = bleManager.onStateChange((state) => {
      setBleState(state);
    }, true);
    return () => sub.remove();
  }, []);

  /* DAY 4 Code Along
  1. Create an effect that logs when new data is received.
  2. Alert when a sequence number is skipped (aka data is missed).
  3. Send acknowledgements back to the device when data is received in order.
  */

  // Android permissions
  async function requestPermissions() {
    if (Platform.OS !== "android") return true;
    const apiLevel = Platform.Version;
    if (apiLevel >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED,
      );
    } else {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  }

  async function startScan() {
    if (bleState !== State.PoweredOn) {
      Alert.alert(
        "Bluetooth Off",
        "Please enable Bluetooth to scan for devices.",
      );
      return;
    }
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert("Permission Denied", "Bluetooth permissions are required.");
      return;
    }
    // TODO: reset the devices state to its original value
    // TODO: set the scanning state to true

    bleManager.startDeviceScan(
      // starts device scan
      [HEART_RATE_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          setScanning(false);
          return;
        }
        if (device) {
          // TODO: uncomment the following line after you made the devices state
          // setDevices((prev) => {
          //   if (prev.find((d) => d.id === device.id)) return prev;
          //   return [...prev, device];
          // });
        }
      },
    );

    scanTimeout.current = setTimeout(() => {
      bleManager.stopDeviceScan(); // stops scanning for devices
      setScanning(false);
    }, 12000);
  }

  // TODO: Challenge: create a function called stopScan that does the following:
  // - stops the device scan (hint: check elsewhere in the code ;) )
  // - clears the scan timeout (hint: search up what clearTimeout does)
  // - sets the scanning state to false

  async function connectToDevice(device: Device) {
    // TODO: call stopScan
    // TODO: set connectingId state to device id (hint: you will need dot notation)
    try {
      const connected = await bleManager.connectToDevice(device.id);
      await connected.discoverAllServicesAndCharacteristics();
      // TODO: set connected device state to connected device
      // TODO: reset prevSeqNum to its original value
      subscription.current = connected.monitorCharacteristicForService(
        HEART_RATE_SERVICE_UUID,
        HEART_RATE_CHARACTERISTIC_UUID,
        (err, characteristic) => {
          if (err) {
            return;
          }
          if (characteristic?.value) {
            // TODO: call parseHeartRate on the characteristic value and extract the sequence number, heart rate, and RR intervals
            // TODO: set the sequence number state
            // TODO: set the heart rate state
            // TODO: set the RR intervals state
          }
        },
      );
    } catch (e: any) {
      Alert.alert("Connection Failed", e.message);
    } finally {
      // TODO: set connectingId state to null
    }
  }

  // TODO: uncomment the following function once all state is defined
  // async function disconnect() {
  //   if (!connectedDevice) return;
  //   subscription.current?.remove();
  //   try {
  //     await bleManager.cancelDeviceConnection(connectedDevice.id);
  //   } catch (_) {}
  //   setConnectedDevice(null);
  //   setHeartRate(0);
  //   setRrIntervals([]);
  // }

  // const isConnected = !!connectedDevice; TODO: uncomment this line

  return (
    <SafeAreaView style={styles.safe}>
      {/* TODO: Use a StatusBar component and set barStyle to "light-content" and backgroundColor to a hex colour of your choice*/}

      {/* Header */}
      <View style={styles.header}>
        {/* TODO: Use a Text component that says PULSE and apply the headerTitle style to it */}
        {/* TODO: Use a Text component that says BLE Heart Rate Monitor and apply the headerSub style to it */}
        <View
          style={[
            styles.bleDot,
            {
              backgroundColor: bleState === "PoweredOn" ? "#69f0ae" : "#ef5350",
            },
          ]}
        />
      </View>

      {/* Connected view */}
      {isConnected ? (
        <View style={styles.connectedContainer}>
          <Text style={styles.connectedLabel}>
            ⬤ {connectedDevice.name || connectedDevice.id}
          </Text>
          {/* TODO: Use a BpmGauge component and set its bpm to be the heartRate state */}
          {rrIntervals.length > 0 && (
            <View style={styles.rrContainer}>
              <Text style={styles.rrLabel}>RR INTERVALS</Text>
              <Text style={styles.rrValues}>
                {rrIntervals.map((r) => `${r}ms`).join("  ·  ")}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
            <Text style={styles.disconnectBtnText}>DISCONNECT</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Scan view */
        <View style={styles.scanContainer}>
          <TouchableOpacity
            style={[styles.scanBtn, scanning && styles.scanBtnActive]}
            onPress={scanning ? stopScan : startScan}
            activeOpacity={0.8}
          >
            {scanning ? (
              <View style={styles.scanBtnInner}>
                <ActivityIndicator color="#0a0a0f" size="small" />
                <Text style={styles.scanBtnText}>SCANNING…</Text>
              </View>
            ) : (
              <Text style={styles.scanBtnText}>SCAN FOR SENSORS</Text>
            )}
          </TouchableOpacity>

          {devices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyText}>
                {scanning
                  ? "Searching for Heart Rate sensors nearby…"
                  : "No sensors found yet.\nTap Scan to begin."}
              </Text>
            </View>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              style={styles.deviceList}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => {
                return (
                  // TODO: Challenge: return a DeviceRow component with the device prop set to item,
                  // onPress set to connectToDevice, and isConnecting set to connectingId === item.id
                );
              }}
              ListHeaderComponent={
                <Text style={styles.listHeader}>
                  {devices.length} SENSOR{devices.length !== 1 ? "S" : ""} FOUND
                </Text>
              }
            />
          )}
        </View>
      )}

      {/* Log */}
      <View style={styles.logContainer}>
        <Text style={styles.logHeader}>LOG</Text>
        <FlatList
          data={log}
          keyExtractor={(_, i) => String(i)}
          style={styles.logList}
          renderItem={({ item }) => <Text style={styles.logEntry}>{item}</Text>}
        />
      </View>
    </SafeAreaView>
  );
}
