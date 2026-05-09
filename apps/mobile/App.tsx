import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { searchCatalog, LegoCatalogItem, setConfig } from '@lego-tracker/core';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [results, setResults] = useState<LegoCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    async function loadConfig() {
      // Simulate loading from SecureStore or Constants
      // In a real app, this would be: await SecureStore.getItemAsync('REBRICKABLE_API_KEY')
      setConfig({
        rebrickableApiKey: '', // Load from secure source
        supabaseUrl: '',
        supabaseAnonKey: '',
      });
      if (isMountedRef.current) {
        setConfigLoaded(true);
      }
    }

    loadConfig();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleBarCodeScanned = useCallback(async ({ data }: { type: string, data: string }) => {
    if (!configLoaded) return;

    setScanned(true);
    setLoading(true);
    setError(null);

    try {
      const items = await searchCatalog(data);
      if (isMountedRef.current) {
        setResults(items);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to lookup barcode. Please try again.');
        console.error(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [configLoaded]);

  if (!permission || !configLoaded) {
    // Camera permissions or config are still loading.
    return <View style={styles.container}><Text style={styles.statusText}>Initializing...</Text></View>;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const resetScan = () => {
    setScanned(false);
    setResults([]);
    setError(null);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "upc_a", "code128"],
        }}
      />

      <View style={styles.overlay}>
        {loading && <Text style={styles.statusText}>Searching...</Text>}
        {error && <Text style={[styles.statusText, { backgroundColor: 'rgba(201, 47, 47, 0.8)' }]}>{error}</Text>}
        {scanned && !loading && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>
              {results.length > 0 ? `Found: ${results[0].name}` : 'No item found'}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={resetScan}
            >
              <Text style={styles.buttonText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 5,
  },
  resultBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#c92f2f',
    padding: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});
