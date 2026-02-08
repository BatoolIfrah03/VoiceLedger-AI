import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  ActivityIndicator, StatusBar, Animated, AccessibilityInfo 
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy'; 
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Mic, Wallet, Trash2, History, Camera, 
  Calendar as CalIcon, Info, ChevronLeft, 
  ChevronRight, TrendingUp, TrendingDown, AlertCircle 
} from 'lucide-react-native';

// --- CONFIGURATION ---
const GEMINI_API_KEYS = [];

const COUNTRIES = [
  { id: 'PK', name: 'Pakistan', currency: 'PKR', symbol: 'Rs.', lang: 'Urdu/Hindi/English mix', example: '"100 rupay ki chaye bechi" or "Ali ko 500 diye"' },
  { id: 'US', name: 'USA', currency: 'USD', symbol: '$', lang: 'English', example: '"Sold pizza for 15 dollars" or "Paid 10 for gas"' },
  { id: 'IN', name: 'India', currency: 'INR', symbol: '₹', lang: 'Hindi/English', example: '"50 rupay ka doodh becha" or "Karan ko 200 diye"' },
];

export default function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [isChangingCountry, setIsChangingCountry] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  
  // Custom Toast State
  const [errorToast, setErrorToast] = useState({ visible: false, message: '' });
  const keyIndex = useRef(0);

  useEffect(() => {
    (async () => {
      const savedCountry = await AsyncStorage.getItem('userCountry');
      const savedDate = await AsyncStorage.getItem('startDate');
      const savedTrans = await AsyncStorage.getItem('transactions');
      if (savedCountry && savedDate) {
        setSelectedCountry(JSON.parse(savedCountry));
        const sDate = new Date(savedDate);
        sDate.setHours(0, 0, 0, 0); // Normalize for calendar logic
        setStartDate(sDate);
        setIsFirstLaunch(false);
      }
      if (savedTrans) setTransactions(JSON.parse(savedTrans));
    })();
  }, []);

  const showError = (msg) => {
    setErrorToast({ visible: true, message: msg });
    setTimeout(() => setErrorToast({ visible: false, message: '' }), 4000);
  };

  const getNextKey = () => {
    keyIndex.current = (keyIndex.current + 1) % GEMINI_API_KEYS.length;
    return GEMINI_API_KEYS[keyIndex.current];
  };

  const updateTransactions = async (newTrans) => {
    setTransactions(newTrans);
    await AsyncStorage.setItem('transactions', JSON.stringify(newTrans));
  };

  const setupUser = async (country) => {
    const normalizedNow = new Date();
    normalizedNow.setHours(0, 0, 0, 0);
    setSelectedCountry(country);
    setStartDate(normalizedNow);
    setIsFirstLaunch(false);
    setIsChangingCountry(false);
    await AsyncStorage.setItem('userCountry', JSON.stringify(country));
    await AsyncStorage.setItem('startDate', normalizedNow.toISOString());
  };

  // Logic: Sale (+) vs Debt (-)
  const dailySummary = useMemo(() => {
    const filtered = transactions.filter(t => new Date(t.timestamp).toDateString() === viewDate.toDateString());
    let sales = 0, debt = 0;
    filtered.forEach(t => t.type === 'sale' ? sales += Number(t.amount) : debt += Number(t.amount));
    return { sales, debt };
  }, [transactions, viewDate]);

  const walletTotal = useMemo(() => {
    let total = 0;
    transactions.forEach(t => t.type === 'sale' ? total += Number(t.amount) : total -= Number(t.amount));
    return total;
  }, [transactions]);

  // AI Logic with Key Rotation
  async function callGemini(parts, retryCount = 0) {
    setLoading(true);
    const currentKey = GEMINI_API_KEYS[keyIndex.current];

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
        })
      });
      const res = await response.json();
      
      if (res.error) {
        if (res.error.code === 429 && retryCount < GEMINI_API_KEYS.length) {
          getNextKey();
          return setTimeout(() => callGemini(parts, retryCount + 1), 1500); 
        }
        setLoading(false);
        showError("Daily limit reached. Please try again later.");
        return;
      }
      
      const rawText = res.candidates[0].content.parts[0].text;
      const data = JSON.parse(rawText);

      if (!data.amount || isNaN(data.amount) || data.amount <= 0) {
        setLoading(false);
        showError("AI didn't catch that. Please speak clearly.");
        return;
      }

      const newTrans = [{ 
        item: data.item || "Transaction",
        amount: Number(data.amount),
        type: data.type === 'debt' ? 'debt' : 'sale',
        id: Date.now(), 
        timestamp: new Date().toISOString() 
      }, ...transactions];
      updateTransactions(newTrans);
      
    } catch (e) {
      showError("AI is confused. Please speak/scan again.");
    } finally { 
      setLoading(false); 
    }
  }

  const handlePressIn = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(newRec);
    } catch (err) {}
  };

  const handlePressOut = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      
      callGemini([
        { text: `JSON ONLY: {"item": "string", "amount": number, "type": "sale"|"debt"}. 
                 Context: Sale (+) means selling/earning. Debt (-) means giving/spending money. 
                 Lang: ${selectedCountry.lang}.` },
        { inline_data: { mime_type: "audio/mp4", data: base64Audio } }
      ]);
    } catch (e) { setRecording(null); }
  };

  const scanReceipt = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.1 });
    if (!result.canceled) {
      callGemini([
        { text: "Find total amount on receipt. Return JSON ONLY: {\"item\": \"receipt\", \"amount\": number, \"type\": \"debt\"}." },
        { inline_data: { mime_type: "image/jpeg", data: result.assets[0].base64 } }
      ]);
    }
  };

  const deleteTrans = (id) => updateTransactions(transactions.filter(t => t.id !== id));

  if (isFirstLaunch || isChangingCountry) {
    return (
      <View style={styles.setupContainer}>
        <Wallet color="#1e40af" size={80} accessibilityLabel="VoiceLedger Logo" />
        <Text style={styles.setupTitle}>VoiceLedger</Text>
        <Text style={styles.setupSub}>Select your wallet region:</Text>
        {COUNTRIES.map(c => (
          <TouchableOpacity 
            key={c.id} style={styles.setupBtn} onPress={() => setupUser(c)}
            accessibilityRole="button" accessibilityLabel={`Set region to ${c.name}`}
          >
            <Text style={styles.setupBtnText}>{c.name} ({c.currency})</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER SECTION */}
      <View style={styles.topHeader}>
        <View style={styles.rowBetween}>
          <Text style={styles.logoText} accessibilityRole="header">VoiceLedger AI</Text>
          <TouchableOpacity 
            style={styles.badge} onPress={() => setIsChangingCountry(true)}
            accessibilityLabel="Change region" accessibilityRole="button"
          >
            <Text style={styles.badgeText}>{selectedCountry.currency} ↺</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Lifetime Wallet Balance</Text>
          <Text style={styles.walletAmt} accessibilityLabel={`Total balance is ${walletTotal} ${selectedCountry.currency}`}>
            {selectedCountry.symbol}{walletTotal.toLocaleString()}
          </Text>
          <Text style={styles.dateDisplay}>{viewDate.toDateString()}</Text>
        </View>
      </View>

      {/* TRENDS STRIP */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem} accessibilityLabel={`Daily sales: ${dailySummary.sales}`}>
          <TrendingUp color="#22c55e" size={20} />
          <Text style={styles.summaryVal}>+{selectedCountry.symbol}{dailySummary.sales}</Text>
        </View>
        <View style={styles.summaryItem} accessibilityLabel={`Daily expenses: ${dailySummary.debt}`}>
          <TrendingDown color="#ef4444" size={20} />
          <Text style={styles.summaryVal}>-{selectedCountry.symbol}{dailySummary.debt}</Text>
        </View>
      </View>

      {/* CALENDAR NAV */}
      <View style={styles.calendarNav}>
        <TouchableOpacity 
          onPress={() => {
            const prev = new Date(viewDate);
            prev.setDate(prev.getDate() - 1);
            prev.setHours(0,0,0,0);
            if (prev.getTime() >= startDate.getTime()) setViewDate(prev);
          }}
          accessibilityLabel="Go to previous day" accessibilityRole="button"
        >
          <ChevronLeft color="#1e40af" />
        </TouchableOpacity>
        
        <View style={styles.dateLabelBox} accessibilityLabel={`Selected date is ${viewDate.toDateString()}`}>
           <CalIcon size={14} color="#1e40af" style={{marginRight: 8}} />
           <Text style={styles.calDateText}>
             {viewDate.toDateString() === new Date().toDateString() ? "TODAY" : viewDate.toDateString()}
           </Text>
        </View>

        <TouchableOpacity 
          onPress={() => {
            const next = new Date(viewDate);
            next.setDate(next.getDate() + 1);
            next.setHours(0,0,0,0);
            const today = new Date(); today.setHours(0,0,0,0);
            if (next.getTime() <= today.getTime()) setViewDate(next);
          }}
          accessibilityLabel="Go to next day" accessibilityRole="button"
        >
          <ChevronRight color={viewDate.toDateString() === new Date().toDateString() ? "#ccc" : "#1e40af"} />
        </TouchableOpacity>
      </View>

      {/* TRANSACTION LIST */}
      <ScrollView style={styles.content}>
        {transactions.filter(t => new Date(t.timestamp).toDateString() === viewDate.toDateString()).length === 0 ? (
          <View style={styles.emptyView}>
            <Info color="#ccc" size={40} />
            <Text style={styles.emptyText}>No records for this day.</Text>
          </View>
        ) : (
          transactions.filter(t => new Date(t.timestamp).toDateString() === viewDate.toDateString()).map((t) => (
            <View key={t.id} style={styles.transCard} accessibilityLabel={`${t.item}: ${t.type === 'sale' ? 'received' : 'gave'} ${t.amount}`}>
              <View style={{flex:1}}>
                <Text style={styles.transItem}>{t.item}</Text>
                <Text style={styles.transTime}>{new Date(t.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={[styles.transAmt, {color: t.type === 'sale' ? '#22c55e' : '#ef4444'}]}>
                  {t.type === 'sale' ? '+' : '-'}{selectedCountry.symbol}{t.amount}
                </Text>
                <TouchableOpacity onPress={() => deleteTrans(t.id)} accessibilityLabel="Delete transaction" accessibilityRole="button">
                  <Trash2 size={14} color="#ddd" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* TOAST ERROR UI */}
      {errorToast.visible && (
        <View style={styles.toastContainer} accessibilityLiveRegion="assertive">
           <AlertCircle color="white" size={20} />
           <Text style={styles.toastText}>{errorToast.message}</Text>
        </View>
      )}

      {/* FOOTER ACTIONS */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.sideBtn} onPress={scanReceipt}
          accessibilityLabel="Scan receipt using camera" accessibilityRole="button"
        >
          <Camera color="#1e40af" size={30} />
          <Text style={styles.btnText}>Scan Bill</Text>
        </TouchableOpacity>

        <View style={styles.micContainer}>
          {recording && <View style={styles.pulse} />}
          <TouchableOpacity 
            style={[styles.micBtn, recording && styles.micActive]} 
            onPressIn={handlePressIn} onPressOut={handlePressOut}
            accessibilityLabel={recording ? "Recording... Release to process" : "Hold to speak transaction"}
            accessibilityRole="button"
          >
            {loading ? <ActivityIndicator color="white" /> : <Mic color="white" size={36} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.sideBtn} 
          onPress={() => { const d = new Date(); d.setHours(0,0,0,0); setViewDate(d); }}
          accessibilityLabel="Reset calendar to today" accessibilityRole="button"
        >
          <History color="#1e40af" size={30} />
          <Text style={styles.btnText}>Today</Text>
        </TouchableOpacity>
      </View>

      {recording && (
        <View style={styles.recordingOverlay}>
          <Text style={styles.recText}>LISTENING... Speak Now</Text>
          <Text style={styles.recSubText}>{selectedCountry.example}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  setupContainer: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 40 },
  setupTitle: { fontSize: 36, fontWeight: 'bold', color: '#1e40af' },
  setupSub: { fontSize: 16, color: '#666', marginBottom: 30, marginTop: 10 },
  setupBtn: { width: '100%', padding: 22, backgroundColor: '#eef2ff', borderRadius: 20, marginBottom: 15, alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db' },
  setupBtnText: { fontSize: 18, fontWeight: 'bold', color: '#1e40af' },
  topHeader: { backgroundColor: '#1e40af', paddingTop: 60, paddingBottom: 50, paddingHorizontal: 25, borderBottomLeftRadius: 50, borderBottomRightRadius: 50, elevation: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoText: { color: 'white', fontWeight: 'bold', fontSize: 20 },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10 },
  badgeText: { color: 'white', fontWeight: 'bold' },
  walletCard: { marginTop: 20, alignItems: 'center' },
  walletLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  walletAmt: { color: 'white', fontSize: 52, fontWeight: '900' },
  dateDisplay: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 5 },
  summaryStrip: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: -30 },
  summaryItem: { backgroundColor: 'white', paddingHorizontal: 25, paddingVertical: 18, borderRadius: 25, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 15 },
  summaryVal: { fontWeight: 'bold', fontSize: 18 },
  calendarNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 25, gap: 15 },
  dateLabelBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, elevation: 3 },
  calDateText: { fontWeight: 'bold', color: '#1e40af', fontSize: 14 },
  content: { flex: 1, paddingHorizontal: 20 },
  transCard: { backgroundColor: 'white', padding: 20, borderRadius: 22, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  transItem: { fontWeight: 'bold', fontSize: 18, textTransform: 'capitalize', color: '#1f2937' },
  transTime: { fontSize: 12, color: '#9ca3af' },
  transAmt: { fontSize: 19, fontWeight: '900' },
  emptyView: { alignItems: 'center', marginTop: 50, opacity: 0.3 },
  emptyText: { marginTop: 10, color: '#666', fontWeight: '600' },
  toastContainer: { position: 'absolute', bottom: 130, alignSelf: 'center', backgroundColor: '#374151', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 10, width: '90%', elevation: 10, borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  toastText: { color: 'white', fontSize: 13, fontWeight: '500', flex: 1 },
  footer: { paddingBottom: 40, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 10 },
  micContainer: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center' },
  micBtn: { width: 85, height: 85, borderRadius: 45, backgroundColor: '#1e40af', justifyContent: 'center', alignItems: 'center', elevation: 15, zIndex: 10 },
  micActive: { backgroundColor: '#ef4444' },
  pulse: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(239, 68, 68, 0.4)' },
  sideBtn: { alignItems: 'center' },
  btnText: { fontSize: 12, fontWeight: 'bold', color: '#1e40af', marginTop: 8 },
  recordingOverlay: { position: 'absolute', bottom: 150, alignSelf: 'center', backgroundColor: '#ef4444', padding: 25, borderRadius: 30, width: '85%', alignItems: 'center', elevation: 25 },
  recText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  recSubText: { color: 'white', fontSize: 13, opacity: 0.9, marginTop: 8, textAlign: 'center' }
});
