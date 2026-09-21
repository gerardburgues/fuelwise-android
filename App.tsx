import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { initDb, getProfile, saveProfile, getMealsForDate, addMeal, getActivityDay } from '@/db/database';
import { connectHealthConnect, importHealthDays } from '@/services/health';
import { OpenAIKeyStore, estimateFoodFromText, estimateFoodFromImage, askCoach } from '@/services/openai';
import { calculateStartingTargets } from '@/utils/targets';
import type { Meal, Profile, ActivityDay, FoodEstimate } from '@/types';

type Tab = 'today'|'add'|'coach'|'settings';
const todayKey = () => new Date().toISOString().slice(0,10);

export default function App() {
  const [tab,setTab]=useState<Tab>('today');
  const [profile,setProfile]=useState<Profile|null>(null);
  const [meals,setMeals]=useState<Meal[]>([]);
  const [activity,setActivity]=useState<ActivityDay|null>(null);
  const [busy,setBusy]=useState(false);
  const [foodText,setFoodText]=useState('');
  const [estimate,setEstimate]=useState<FoodEstimate|null>(null);
  const [question,setQuestion]=useState('What should I eat now?');
  const [answer,setAnswer]=useState('');
  const [apiKey,setApiKey]=useState('');

  const refresh=async()=>{ const p=await getProfile(); setProfile(p); setMeals(await getMealsForDate(todayKey())); setActivity(await getActivityDay(todayKey())); };
  useEffect(()=>{(async()=>{await initDb(); await refresh(); setApiKey((await OpenAIKeyStore.get())||'');})();},[]);
  const totals=useMemo(()=>meals.reduce((a,m)=>({cal:a.cal+m.calories,p:a.p+m.protein,c:a.c+m.carbs,f:a.f+m.fat}),{cal:0,p:0,c:0,f:0}),[meals]);
  if(!profile) return <SafeAreaView style={s.root}><ActivityIndicator/></SafeAreaView>;

  const analyze30=async()=>{try{setBusy(true); await connectHealthConnect(); const days=await importHealthDays(30); const t=calculateStartingTargets(profile,days); await saveProfile({caloriesTarget:t.calories,proteinTarget:t.protein,carbsTarget:t.carbs,fatTarget:t.fat}); await refresh(); Alert.alert('30-day analysis complete',`Average burn ~${t.avgBurn} kcal/day\nNew target: ${t.calories} kcal`);}catch(e:any){Alert.alert('Health Connect',e.message)}finally{setBusy(false)}};
  const analyzeText=async()=>{try{setBusy(true);setEstimate(await estimateFoodFromText(foodText));}catch(e:any){Alert.alert('AI',e.message)}finally{setBusy(false)}};
  const analyzePhoto=async()=>{const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],base64:true,quality:.7}); if(r.canceled||!r.assets[0].base64)return; try{setBusy(true);setEstimate(await estimateFoodFromImage(r.assets[0].base64));}catch(e:any){Alert.alert('AI',e.message)}finally{setBusy(false)}};
  const saveEstimate=async()=>{if(!estimate)return; await addMeal({eatenAt:new Date().toISOString(),title:estimate.title,calories:estimate.calories,protein:estimate.protein,carbs:estimate.carbs,fat:estimate.fat,source:'text'}); setEstimate(null);setFoodText('');await refresh();setTab('today');};
  const coach=async()=>{try{setBusy(true);setAnswer(await askCoach(question,{profile,meals,activity}));}catch(e:any){Alert.alert('AI',e.message)}finally{setBusy(false)}};

  return <SafeAreaView style={s.root}><StatusBar style="light"/><View style={s.header}><Text style={s.logo}>FUELWISE</Text><Text style={s.goal}>Lean muscle gain</Text></View><ScrollView contentContainerStyle={s.content}>
    {tab==='today' && <>
      <Text style={s.h1}>Today</Text><Card><Text style={s.big}>{Math.round(totals.cal)} / {profile.caloriesTarget} kcal</Text><Text style={s.muted}>{Math.max(0,Math.round(profile.caloriesTarget-totals.cal))} kcal remaining</Text></Card>
      <View style={s.row}><Mini label="Protein" value={`${Math.round(totals.p)} / ${profile.proteinTarget} g`}/><Mini label="Carbs" value={`${Math.round(totals.c)} / ${profile.carbsTarget} g`}/></View>
      <View style={s.row}><Mini label="Fat" value={`${Math.round(totals.f)} / ${profile.fatTarget} g`}/><Mini label="Burn" value={activity?`${Math.round(activity.totalCalories)} kcal`:'Sync Garmin'}/></View>
      <Pressable style={s.primary} onPress={()=>setTab('add')}><Text style={s.primaryText}>+ Add food</Text></Pressable>
      <Pressable style={s.secondary} onPress={()=>setTab('coach')}><Text style={s.secondaryText}>Ask coach →</Text></Pressable>
      <Text style={s.h2}>Meals</Text>{meals.length===0?<Text style={s.muted}>Nothing logged yet.</Text>:meals.map(m=><Card key={m.id}><View style={s.between}><Text style={s.cardTitle}>{m.title}</Text><Text style={s.cardTitle}>{Math.round(m.calories)} kcal</Text></View><Text style={s.muted}>{Math.round(m.protein)}g protein · {Math.round(m.carbs)}g carbs · {Math.round(m.fat)}g fat</Text></Card>)}
    </>}
    {tab==='add' && <><Text style={s.h1}>Log food</Text><TextInput style={s.input} placeholder="e.g. 200g chicken, rice, vegetables and olive oil" placeholderTextColor="#7c8190" value={foodText} onChangeText={setFoodText} multiline/><Pressable style={s.primary} onPress={analyzeText}><Text style={s.primaryText}>Analyze description</Text></Pressable><Pressable style={s.secondary} onPress={analyzePhoto}><Text style={s.secondaryText}>Choose food photo</Text></Pressable>{estimate&&<Card><Text style={s.h2}>{estimate.title}</Text><Text style={s.big}>{Math.round(estimate.calories)} kcal</Text><Text style={s.muted}>{Math.round(estimate.protein)}g protein · {Math.round(estimate.carbs)}g carbs · {Math.round(estimate.fat)}g fat · confidence {estimate.confidence}</Text>{estimate.items.map((x,i)=><Text key={i} style={s.item}>{x.name}{x.grams?` · ${Math.round(x.grams)}g`:''} — {Math.round(x.calories)} kcal</Text>)}<Pressable style={s.primary} onPress={saveEstimate}><Text style={s.primaryText}>Save meal</Text></Pressable></Card>}</>}
    {tab==='coach' && <><Text style={s.h1}>AI Coach</Text><Text style={s.muted}>The coach sees today's meals, your targets, and today's Garmin/Health Connect activity.</Text><TextInput style={s.input} value={question} onChangeText={setQuestion} multiline/><Pressable style={s.primary} onPress={coach}><Text style={s.primaryText}>Ask</Text></Pressable>{answer?<Card><Text style={s.answer}>{answer}</Text></Card>:null}</>}
    {tab==='settings' && <><Text style={s.h1}>Settings</Text><Card><Text style={s.cardTitle}>OpenAI API key</Text><TextInput style={s.input} secureTextEntry value={apiKey} onChangeText={setApiKey} placeholder="sk-..." placeholderTextColor="#7c8190"/><Pressable style={s.primary} onPress={async()=>{await OpenAIKeyStore.set(apiKey.trim());Alert.alert('Saved','API key stored securely on this phone.')}}><Text style={s.primaryText}>Save API key</Text></Pressable></Card><Card><Text style={s.cardTitle}>Garmin via Health Connect</Text><Text style={s.muted}>Garmin Connect must be configured to share its data with Android Health Connect.</Text><Pressable style={s.primary} onPress={analyze30}><Text style={s.primaryText}>{busy?'Working…':'Connect + analyze last 30 days'}</Text></Pressable></Card><Card><Text style={s.cardTitle}>Your goal</Text><Text style={s.big}>{profile.weightKg} kg → {profile.targetWeightKg} kg</Text><Text style={s.muted}>Target gain: +{profile.weeklyRateKg} kg/week</Text></Card></>}
    {busy&&<ActivityIndicator style={{marginTop:20}}/>}
  </ScrollView><View style={s.nav}>{(['today','add','coach','settings'] as Tab[]).map(x=><Pressable key={x} onPress={()=>setTab(x)}><Text style={[s.navText,tab===x&&s.navActive]}>{x.toUpperCase()}</Text></Pressable>)}</View></SafeAreaView>
}

function Card({children}:{children:React.ReactNode}){return <View style={s.card}>{children}</View>}
function Mini({label,value}:{label:string,value:string}){return <View style={s.mini}><Text style={s.muted}>{label}</Text><Text style={s.cardTitle}>{value}</Text></View>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#0d0f12'},header:{paddingHorizontal:20,paddingTop:12,paddingBottom:8,borderBottomWidth:1,borderBottomColor:'#22262e'},logo:{color:'#b8ff64',fontWeight:'900',fontSize:17,letterSpacing:2},goal:{color:'#8b92a1',fontSize:12,marginTop:3},content:{padding:20,paddingBottom:120,gap:12},h1:{color:'white',fontSize:32,fontWeight:'800',marginBottom:4},h2:{color:'white',fontSize:20,fontWeight:'800',marginTop:8},big:{color:'white',fontSize:26,fontWeight:'800'},muted:{color:'#969dab',fontSize:14,lineHeight:20},card:{backgroundColor:'#171a20',borderRadius:18,padding:18,gap:8,borderWidth:1,borderColor:'#252a33'},row:{flexDirection:'row',gap:12},mini:{flex:1,backgroundColor:'#171a20',padding:16,borderRadius:16,borderWidth:1,borderColor:'#252a33'},cardTitle:{color:'white',fontWeight:'700',fontSize:16},primary:{backgroundColor:'#b8ff64',padding:16,borderRadius:14,alignItems:'center',marginTop:4},primaryText:{color:'#10130d',fontWeight:'900'},secondary:{backgroundColor:'#22262e',padding:16,borderRadius:14,alignItems:'center'},secondaryText:{color:'white',fontWeight:'800'},input:{backgroundColor:'#171a20',borderWidth:1,borderColor:'#2a303a',borderRadius:14,padding:14,color:'white',minHeight:54,textAlignVertical:'top'},item:{color:'#d6dae1',paddingVertical:2},answer:{color:'white',fontSize:16,lineHeight:24},between:{flexDirection:'row',justifyContent:'space-between',gap:12},nav:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:'#111419',borderTopWidth:1,borderTopColor:'#252a33',paddingVertical:18,paddingHorizontal:22,flexDirection:'row',justifyContent:'space-between'},navText:{color:'#6f7684',fontSize:11,fontWeight:'800'},navActive:{color:'#b8ff64'}});
