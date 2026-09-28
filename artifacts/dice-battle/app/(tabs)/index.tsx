import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAudioPlayer } from 'expo-audio';
import * as ScreenOrientation from 'expo-screen-orientation';
import { OrientationLock } from 'expo-screen-orientation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gameThemes } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';

type Screen = 'home' | 'setup' | 'settings' | 'game' | 'result' | 'howto';
type OrientationChoice = 'auto' | 'portrait' | 'landscape';
type ThemeChoice = 'midnight' | 'contrast';
type Player = {
  name: string;
  image: string | null;
  accent: 'one' | 'two';
};
type Settings = {
  rounds: number;
  orientation: OrientationChoice;
  sound: boolean;
  vibration: boolean;
  theme: ThemeChoice;
};
type RoundScore = { round: number; p1: number; p2: number };

const DEFAULT_SETTINGS: Settings = {
  rounds: 5,
  orientation: 'auto',
  sound: true,
  vibration: true,
  theme: 'midnight',
};
const DEFAULT_PLAYERS: [Player, Player] = [
  { name: 'Player 1', image: null, accent: 'one' },
  { name: 'Player 2', image: null, accent: 'two' },
];
const DICE_PATTERNS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const rollAudio = require('../../assets/sounds/roll.mp3');
const resultAudio = require('../../assets/sounds/result.mp3');
const winnerAudio = require('../../assets/sounds/winner.mp3');
const appIcon = require('../../assets/images/icon.png');

function DiceFace({
  value,
  size,
  colors,
}: {
  value: number;
  size: number;
  colors: ReturnType<typeof useColors>;
}) {
  const dots = DICE_PATTERNS[value] ?? DICE_PATTERNS[1];
  return (
    <View
      style={[
        styles.diceFace,
        {
          width: size,
          height: size,
          borderRadius: size * 0.2,
          backgroundColor: colors.foreground,
          shadowColor: colors.primary,
        },
      ]}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <View
          key={index}
          style={[
            styles.diceCell,
            { width: size / 3, height: size / 3 },
          ]}
        >
          {dots.includes(index) ? (
            <View
              style={[
                styles.diceDot,
                {
                  width: size * 0.105,
                  height: size * 0.105,
                  borderRadius: size * 0.06,
                  backgroundColor: colors.background,
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  colors,
  muted = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  muted?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: muted ? colors.muted : colors.secondary },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.foreground} />
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
  colors,
  icon,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
}) {
  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.destructive
        : variant === 'secondary'
          ? colors.secondary
          : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: background,
          borderColor: variant === 'outline' ? colors.border : background,
          opacity: disabled ? 0.45 : 1,
        },
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={19}
          color={variant === 'outline' ? colors.foreground : colors.primaryForeground}
        />
      ) : null}
      <Text
        style={[
          styles.primaryButtonText,
          {
            color: variant === 'outline' ? colors.foreground : colors.primaryForeground,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ children, colors }: { children: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{children}</Text>;
}

function Toggle({
  value,
  onChange,
  colors,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[
        styles.toggle,
        { backgroundColor: value ? colors.primary : colors.secondary },
      ]}
    >
      <View
        style={[
          styles.toggleKnob,
          { backgroundColor: colors.foreground, alignSelf: value ? 'flex-end' : 'flex-start' },
        ]}
      />
    </Pressable>
  );
}

function Header({
  title,
  subtitle,
  onBack,
  colors,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  colors: ReturnType<typeof useColors>;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton icon="chevron-back" label="Back" onPress={onBack} colors={colors} />
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {right ?? <View style={styles.headerSpacer} />}
    </View>
  );
}

function PlayerAvatar({
  player,
  size,
  colors,
}: {
  player: Player;
  size: number;
  colors: ReturnType<typeof useColors>;
}) {
  const accent = player.accent === 'one' ? colors.playerOne : colors.playerTwo;
  return player.image ? (
    <Image
      source={{ uri: player.image }}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, borderColor: accent },
      ]}
    />
  ) : (
    <View
      style={[
        styles.avatarPlaceholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: accent,
        },
      ]}
    >
      <Ionicons name="person" size={size * 0.45} color={colors.foreground} />
    </View>
  );
}

function PlayerCard({
  player,
  score,
  total,
  active,
  colors,
  landscape = false,
}: {
  player: Player;
  score: number;
  total: number;
  active: boolean;
  colors: ReturnType<typeof useColors>;
  landscape?: boolean;
}) {
  const accent = player.accent === 'one' ? colors.playerOne : colors.playerTwo;
  return (
    <View
      style={[
        styles.playerCard,
        landscape && styles.landscapePlayerCard,
        {
          backgroundColor: colors.card,
          borderColor: active ? accent : colors.border,
          shadowColor: accent,
        },
      ]}
    >
      <View style={styles.playerCardTop}>
        <PlayerAvatar player={player} size={landscape ? 52 : 46} colors={colors} />
        <View style={styles.playerCardIdentity}>
          <Text style={[styles.playerEyebrow, { color: accent }]}>
            {player.accent === 'one' ? 'PLAYER 1' : 'PLAYER 2'}
          </Text>
          <Text numberOfLines={1} style={[styles.playerCardName, { color: colors.foreground }]}>
            {player.name}
          </Text>
        </View>
        {active ? <View style={[styles.activeDot, { backgroundColor: accent }]} /> : null}
      </View>
      <View style={styles.playerScoreRow}>
        <View>
          <Text style={[styles.scoreCaption, { color: colors.mutedForeground }]}>ROUND</Text>
          <Text style={[styles.roundScore, { color: accent }]}>{score}</Text>
        </View>
        <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
        <View>
          <Text style={[styles.scoreCaption, { color: colors.mutedForeground }]}>TOTAL</Text>
          <Text style={[styles.totalScore, { color: colors.foreground }]}>{total}</Text>
        </View>
      </View>
    </View>
  );
}

function HomeScreen({
  colors,
  settings,
  onNewGame,
  onHowTo,
  onSettings,
  onSoundToggle,
}: {
  colors: ReturnType<typeof useColors>;
  settings: Settings;
  onNewGame: () => void;
  onHowTo: () => void;
  onSettings: () => void;
  onSoundToggle: (enabled: boolean) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandMark}>
        <Image source={appIcon} style={styles.homeIcon} />
        <View>
          <Text style={[styles.brandKicker, { color: colors.playerOne }]}>OFFLINE DUEL</Text>
          <Text style={[styles.brandTitle, { color: colors.foreground }]}>DICE BATTLE</Text>
        </View>
      </View>
      <View style={styles.homeHero}>
        <Text style={[styles.homeHeadline, { color: colors.foreground }]}>
          Roll bold.{'\n'}Own the round.
        </Text>
        <Text style={[styles.homeDescription, { color: colors.mutedForeground }]}>
          A head-to-head dice duel for two. No signal, no waiting, just your next roll.
        </Text>
      </View>
      <View style={[styles.homeFeature, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.featureIcon, { backgroundColor: colors.secondary }]}>
          <MaterialCommunityIcons name="dice-5-outline" size={23} color={colors.winner} />
        </View>
        <View style={styles.featureCopy}>
          <Text style={[styles.featureTitle, { color: colors.foreground }]}>Ready for the roll?</Text>
          <Text style={[styles.featureText, { color: colors.mutedForeground }]}>
            {settings.rounds} rounds · Two players · Offline play
          </Text>
        </View>
      </View>
      <View style={[styles.homeSoundRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.homeSoundCopy}>
          <View style={[styles.featureIconSmall, { backgroundColor: colors.card }]}>
            <Ionicons name={settings.sound ? 'volume-high-outline' : 'volume-mute-outline'} size={18} color={settings.sound ? colors.winner : colors.mutedForeground} />
          </View>
          <View>
            <Text style={[styles.featureTitle, { color: colors.foreground }]}>Sound effects</Text>
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>Roll, result and winner audio</Text>
          </View>
        </View>
        <Toggle value={settings.sound} onChange={onSoundToggle} colors={colors} />
      </View>
      <PrimaryButton label="New Game" icon="play" onPress={onNewGame} colors={colors} />
      <View style={styles.homeLinkRow}>
        <Pressable onPress={onHowTo} style={({ pressed }) => [styles.homeLink, pressed && styles.pressed]}>
          <Ionicons name="help-circle-outline" size={19} color={colors.mutedForeground} />
          <Text style={[styles.homeLinkText, { color: colors.mutedForeground }]}>How to Play</Text>
        </Pressable>
        <Pressable onPress={onSettings} style={({ pressed }) => [styles.homeLink, pressed && styles.pressed]}>
          <Ionicons name="settings-outline" size={19} color={colors.mutedForeground} />
          <Text style={[styles.homeLinkText, { color: colors.mutedForeground }]}>Settings</Text>
        </Pressable>
      </View>
      <View style={styles.homeFooter}>
        <Ionicons name={settings.sound ? 'volume-high-outline' : 'volume-mute-outline'} size={14} color={colors.mutedForeground} />
        <Text style={[styles.homeFooterText, { color: colors.mutedForeground }]}>
          Sound {settings.sound ? 'on' : 'off'} · v1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}

function SetupScreen({
  players,
  colors,
  onChange,
  onPickImage,
  onBack,
  onContinue,
}: {
  players: [Player, Player];
  colors: ReturnType<typeof useColors>;
  onChange: (index: 0 | 1, name: string) => void;
  onPickImage: (index: 0 | 1) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      <Header title="Set the lineup" subtitle="Two players. One winner." onBack={onBack} colors={colors} />
      <SectionLabel colors={colors}>PLAYER PROFILES</SectionLabel>
      {players.map((player, index) => {
        const playerIndex = index as 0 | 1;
        const accent = player.accent === 'one' ? colors.playerOne : colors.playerTwo;
        return (
          <View key={player.accent} style={[styles.setupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.setupCardHeader}>
              <View style={[styles.numberBadge, { backgroundColor: accent }]}>
                <Text style={[styles.numberBadgeText, { color: colors.foreground }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.setupCardTitle, { color: colors.foreground }]}>
                {index === 0 ? 'Player 1' : 'Player 2'}
              </Text>
              <View style={[styles.colorLine, { backgroundColor: accent }]} />
            </View>
            <View style={styles.profileRow}>
              <PlayerAvatar player={player} size={74} colors={colors} />
              <View style={styles.profileActions}>
                <TextInput
                  accessibilityLabel={`${index === 0 ? 'Player 1' : 'Player 2'} name`}
                  value={player.name}
                  onChangeText={(text) => onChange(playerIndex, text)}
                  placeholder={`Player ${index + 1} name`}
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={18}
                  style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={player.image ? `Change ${player.name} image` : `Upload ${player.name} image`}
                  onPress={() => onPickImage(playerIndex)}
                  style={({ pressed }) => [
                    styles.uploadButton,
                    { backgroundColor: colors.secondary, borderColor: accent },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name={player.image ? 'image-outline' : 'cloud-upload-outline'} size={17} color={accent} />
                  <Text style={[styles.uploadText, { color: colors.foreground }]}>
                    {player.image ? 'Change Image' : 'Upload Image'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
      <View style={[styles.infoBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Ionicons name="phone-portrait-outline" size={18} color={colors.playerOne} />
        <Text style={[styles.infoBannerText, { color: colors.mutedForeground }]}>
          Photos stay on this device and are never uploaded.
        </Text>
      </View>
      <PrimaryButton label="Choose Game Settings" icon="arrow-forward" onPress={onContinue} colors={colors} />
    </ScrollView>
  );
}

function ChoicePill({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choicePill,
        {
          backgroundColor: active ? colors.primary : colors.secondary,
          borderColor: active ? colors.primary : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function SettingsScreen({
  settings,
  colors,
  fromSetup,
  onChange,
  onBack,
  onStart,
}: {
  settings: Settings;
  colors: ReturnType<typeof useColors>;
  fromSetup: boolean;
  onChange: (next: Partial<Settings>) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
      <Header title="Game settings" subtitle="Make it yours before the first roll." onBack={onBack} colors={colors} />
      <SectionLabel colors={colors}>MATCH LENGTH</SectionLabel>
      <View style={styles.choiceGrid}>
        {[5, 10, 15, 20].map((rounds) => (
          <ChoicePill key={rounds} label={`${rounds} rounds`} active={settings.rounds === rounds} onPress={() => onChange({ rounds })} colors={colors} />
        ))}
      </View>
      <SectionLabel colors={colors}>ORIENTATION</SectionLabel>
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {([
          ['auto', 'Auto', 'Let the device choose'],
          ['portrait', 'Portrait', '9 : 16 play layout'],
          ['landscape', 'Landscape', '16 : 9 play layout'],
        ] as const).map(([value, label, description]) => (
          <Pressable
            key={value}
            onPress={() => onChange({ orientation: value })}
            style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}
          >
            <View style={[styles.settingIcon, { backgroundColor: settings.orientation === value ? colors.primary : colors.secondary }]}>
              <Ionicons
                name={value === 'portrait' ? 'phone-portrait-outline' : value === 'landscape' ? 'phone-landscape-outline' : 'scan-outline'}
                size={19}
                color={colors.foreground}
              />
            </View>
            <View style={styles.settingRowCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>{label}</Text>
              <Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>{description}</Text>
            </View>
            <Ionicons
              name={settings.orientation === value ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={settings.orientation === value ? colors.primary : colors.mutedForeground}
            />
          </Pressable>
        ))}
      </View>
      <SectionLabel colors={colors}>EXPERIENCE</SectionLabel>
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="volume-high-outline" size={19} color={colors.winner} />
          </View>
          <View style={styles.settingRowCopy}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Sound effects</Text>
            <Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Roll, result and winner sounds</Text>
          </View>
          <Toggle value={settings.sound} onChange={(sound) => onChange({ sound })} colors={colors} />
        </View>
        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="phone-portrait-outline" size={19} color={colors.playerOne} />
          </View>
          <View style={styles.settingRowCopy}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Vibration</Text>
            <Text style={[styles.settingDescription, { color: colors.mutedForeground }]}>Tactile feedback on each roll</Text>
          </View>
          <Toggle value={settings.vibration} onChange={(vibration) => onChange({ vibration })} colors={colors} />
        </View>
      </View>
      <SectionLabel colors={colors}>THEME</SectionLabel>
      <View style={styles.choiceGrid}>
        <ChoicePill label="Midnight" active={settings.theme === 'midnight'} onPress={() => onChange({ theme: 'midnight' })} colors={colors} />
        <ChoicePill label="High contrast" active={settings.theme === 'contrast'} onPress={() => onChange({ theme: 'contrast' })} colors={colors} />
      </View>
      {!fromSetup ? (
        <>
          <SectionLabel colors={colors}>ABOUT</SectionLabel>
          <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.aboutTitle, { color: colors.foreground }]}>Dice Battle</Text>
            <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>
              Version 1.0.0 · Built for two people, wherever you are.
            </Text>
            <Text style={[styles.privacyText, { color: colors.playerOne }]}>Privacy Policy</Text>
          </View>
        </>
      ) : null}
      <PrimaryButton
        label={fromSetup ? 'Start Battle' : 'Save Settings'}
        icon={fromSetup ? 'play' : 'checkmark'}
        onPress={fromSetup ? onStart : onBack}
        colors={colors}
      />
    </ScrollView>
  );
}

function HowToScreen({ colors, onBack }: { colors: ReturnType<typeof useColors>; onBack: () => void }) {
  const steps = [
    ['1', 'Set your lineup', 'Add names and a photo for each of the two players.'],
    ['2', 'Choose the match', 'Pick 5, 10, 15 or 20 rounds and your preferred orientation.'],
    ['3', 'Take turns', 'Tap the die when it is your turn. The game switches players automatically.'],
    ['4', 'Win the battle', 'The highest total after the final round takes the crown. Equal totals are a draw.'],
  ];
  return (
    <ScrollView contentContainerStyle={styles.formContent}>
      <Header title="How to play" subtitle="Four quick rules. Zero setup." onBack={onBack} colors={colors} />
      <View style={[styles.howtoHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="dice-multiple-outline" size={46} color={colors.winner} />
        <Text style={[styles.howtoHeroTitle, { color: colors.foreground }]}>Every point counts.</Text>
        <Text style={[styles.howtoHeroText, { color: colors.mutedForeground }]}>
          Roll once per turn, watch the score climb, and stay ready for the swing.
        </Text>
      </View>
      {steps.map(([number, title, description]) => (
        <View key={number} style={styles.howtoRow}>
          <View style={[styles.howtoNumber, { backgroundColor: colors.primary }]}>
            <Text style={[styles.howtoNumberText, { color: colors.foreground }]}>{number}</Text>
          </View>
          <View style={styles.howtoCopy}>
            <Text style={[styles.howtoTitle, { color: colors.foreground }]}>{title}</Text>
            <Text style={[styles.howtoDescription, { color: colors.mutedForeground }]}>{description}</Text>
          </View>
        </View>
      ))}
      <View style={[styles.offlineNote, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Ionicons name="cloud-offline-outline" size={20} color={colors.success} />
        <Text style={[styles.offlineText, { color: colors.mutedForeground }]}>
          Dice Battle is fully offline. Your match, sounds and player photos stay on this device.
        </Text>
      </View>
    </ScrollView>
  );
}

function GameScreen({
  players,
  settings,
  colors,
  history,
  scores,
  turn,
  diceValue,
  rolling,
  onRoll,
  onCalculate,
  onPause,
}: {
  players: [Player, Player];
  settings: Settings;
  colors: ReturnType<typeof useColors>;
  history: RoundScore[];
  scores: { p1: number[]; p2: number[] };
  turn: 1 | 2;
  diceValue: number;
  rolling: boolean;
  onRoll: () => void;
  onCalculate: () => void;
  onPause: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const diceScale = useRef(new Animated.Value(1)).current;
  const diceRotate = useRef(new Animated.Value(0)).current;
  const roundNumber = Math.min(history.length + 1, settings.rounds);
  const currentScore = turn === 1 ? scores.p1[history.length] ?? 0 : scores.p2[history.length] ?? 0;
  const totals = {
    p1: scores.p1.reduce((sum, value) => sum + value, 0),
    p2: scores.p2.reduce((sum, value) => sum + value, 0),
  };
  const diceSize = landscape ? Math.min(height * 0.42, 220) : Math.min(width * 0.5, 210);

  useEffect(() => {
    if (rolling) {
      diceRotate.setValue(0);
      Animated.parallel([
        Animated.timing(diceRotate, {
          toValue: 1,
          duration: 820,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.spring(diceScale, { toValue: 0.87, speed: 24, useNativeDriver: true }),
          Animated.spring(diceScale, { toValue: 1.08, speed: 18, useNativeDriver: true }),
          Animated.spring(diceScale, { toValue: 0.96, speed: 22, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      Animated.spring(diceScale, { toValue: 1, speed: 20, useNativeDriver: true }).start();
    }
  }, [diceRotate, diceScale, rolling]);

  const pressIn = () => {
    if (!rolling) Animated.spring(diceScale, { toValue: 0.91, speed: 25, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    if (!rolling) Animated.spring(diceScale, { toValue: 1, useNativeDriver: true }).start();
  };

  const diceAnimatedStyle = {
    transform: [
      { scale: diceScale },
      {
        rotate: diceRotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '720deg'],
        }),
      },
    ],
  };

  const gameHeader = (
    <View style={styles.gameHeader}>
      <View>
        <Text style={[styles.gameEyebrow, { color: colors.playerOne }]}>DICE BATTLE</Text>
        <Text style={[styles.gameTitle, { color: colors.foreground }]}>Round {roundNumber} <Text style={{ color: colors.mutedForeground }}>/ {settings.rounds}</Text></Text>
      </View>
      <View style={styles.gameHeaderActions}>
        <Pressable onPress={onCalculate} style={({ pressed }) => [styles.calculateButton, { borderColor: colors.border, backgroundColor: colors.card }, pressed && styles.pressed]}>
          <Ionicons name="list-outline" size={17} color={colors.foreground} />
          <Text style={[styles.calculateText, { color: colors.foreground }]}>Calculate</Text>
        </Pressable>
        <IconButton icon="pause" label="Pause game" onPress={onPause} colors={colors} />
      </View>
    </View>
  );

  const diceStage = (
    <View style={styles.diceStage}>
      <View style={[styles.turnPill, { backgroundColor: turn === 1 ? colors.playerOne : colors.playerTwo }]}>
        <View style={[styles.turnDot, { backgroundColor: colors.foreground }]} />
        <Text style={[styles.turnPillText, { color: colors.foreground }]}>{players[turn - 1].name}'s turn</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rolling ? 'Dice is rolling' : 'Tap to roll dice'}
        disabled={rolling}
        onPress={onRoll}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.dicePressable}
      >
        <Animated.View style={diceAnimatedStyle}>
          <DiceFace value={diceValue} size={diceSize} colors={colors} />
        </Animated.View>
      </Pressable>
      <Text style={[styles.rollPrompt, { color: colors.foreground }]}>
        {rolling ? 'Rolling...' : 'Tap to Roll'}
      </Text>
      <Text style={[styles.rollHint, { color: colors.mutedForeground }]}>
        {rolling ? 'The die is deciding your next point' : `Round score: ${currentScore}`}
      </Text>
    </View>
  );

  return (
    <View style={styles.gameContent}>
      {gameHeader}
      <View style={[styles.gameBoard, landscape && styles.gameBoardLandscape]}>
        {landscape ? (
          <>
            <View style={styles.landscapeSide}>
              <PlayerCard player={players[0]} score={scores.p1[history.length] ?? 0} total={totals.p1} active={turn === 1} colors={colors} landscape />
            </View>
            {diceStage}
            <View style={styles.landscapeSide}>
              <PlayerCard player={players[1]} score={scores.p2[history.length] ?? 0} total={totals.p2} active={turn === 2} colors={colors} landscape />
            </View>
          </>
        ) : (
          <>
            <View style={styles.portraitPlayers}>
              <PlayerCard player={players[0]} score={scores.p1[history.length] ?? 0} total={totals.p1} active={turn === 1} colors={colors} />
              <PlayerCard player={players[1]} score={scores.p2[history.length] ?? 0} total={totals.p2} active={turn === 2} colors={colors} />
            </View>
            {diceStage}
          </>
        )}
      </View>
    </View>
  );
}

function CalculateModal({
  visible,
  colors,
  history,
  players,
  onClose,
}: {
  visible: boolean;
  colors: ReturnType<typeof useColors>;
  history: RoundScore[];
  players: [Player, Player];
  onClose: () => void;
}) {
  const p1Total = history.reduce((sum, row) => sum + row.p1, 0);
  const p2Total = history.reduce((sum, row) => sum + row.p2, 0);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
          <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.calculateSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.handle }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetEyebrow, { color: colors.winner }]}>MATCH LEDGER</Text>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Round scores</Text>
            </View>
            <IconButton icon="close" label="Close calculate" onPress={onClose} colors={colors} />
          </View>
          {history.length === 0 ? (
            <View style={styles.emptyLedger}>
              <MaterialCommunityIcons name="chart-box-outline" size={34} color={colors.mutedForeground} />
              <Text style={[styles.emptyLedgerTitle, { color: colors.foreground }]}>No completed rounds yet</Text>
              <Text style={[styles.emptyLedgerText, { color: colors.mutedForeground }]}>Roll for both players to start the score table.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.ledgerHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.ledgerHeaderText, styles.ledgerHeaderRoundLabel, { color: colors.mutedForeground }]}>ROUND</Text>
                <Text style={[styles.ledgerHeaderText, { color: colors.playerOne }]}>{players[0].name.toUpperCase()}</Text>
                <Text style={[styles.ledgerHeaderText, { color: colors.playerTwo }]}>{players[1].name.toUpperCase()}</Text>
              </View>
              {history.map((row) => (
                <View key={row.round} style={[styles.ledgerRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.ledgerRound, { color: colors.mutedForeground }]}>0{row.round}</Text>
                  <Text style={[styles.ledgerScore, { color: colors.foreground }]}>{row.p1}</Text>
                  <Text style={[styles.ledgerScore, { color: colors.foreground }]}>{row.p2}</Text>
                </View>
              ))}
              <View style={[styles.ledgerTotals, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.ledgerTotalLabel, { color: colors.foreground }]}>TOTAL</Text>
                <Text style={[styles.ledgerTotal, { color: colors.playerOne }]}>{p1Total}</Text>
                <Text style={[styles.ledgerTotal, { color: colors.playerTwo }]}>{p2Total}</Text>
              </View>
            </ScrollView>
          )}
          <PrimaryButton label="Continue Battle" onPress={onClose} colors={colors} icon="arrow-forward" />
        </View>
      </View>
    </Modal>
  );
}

function PauseModal({
  visible,
  colors,
  onResume,
  onRestart,
  onHome,
}: {
  visible: boolean;
  colors: ReturnType<typeof useColors>;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onResume}>
      <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.pauseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.pauseIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="pause" size={25} color={colors.winner} />
          </View>
          <Text style={[styles.pauseTitle, { color: colors.foreground }]}>Battle paused</Text>
          <Text style={[styles.pauseText, { color: colors.mutedForeground }]}>Take a breather. Your score is safe.</Text>
          <PrimaryButton label="Resume" icon="play" onPress={onResume} colors={colors} />
          <PrimaryButton label="Restart Match" icon="refresh" variant="outline" onPress={onRestart} colors={colors} />
          <Pressable onPress={onHome} style={({ pressed }) => [styles.homeModalButton, pressed && styles.pressed]}>
            <Text style={[styles.homeModalText, { color: colors.mutedForeground }]}>Return Home</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ResultScreen({
  players,
  history,
  colors,
  onPlayAgain,
  onNewGame,
  onHome,
}: {
  players: [Player, Player];
  history: RoundScore[];
  colors: ReturnType<typeof useColors>;
  onPlayAgain: () => void;
  onNewGame: () => void;
  onHome: () => void;
}) {
  const p1Total = history.reduce((sum, row) => sum + row.p1, 0);
  const p2Total = history.reduce((sum, row) => sum + row.p2, 0);
  const winner = p1Total === p2Total ? 0 : p1Total > p2Total ? 1 : 2;
  const winnerName = winner === 0 ? 'A perfect draw' : `${players[winner - 1].name} wins`;
  return (
    <ScrollView contentContainerStyle={styles.resultContent}>
      <View style={[styles.trophyCircle, { backgroundColor: winner === 0 ? colors.secondary : colors.winner }]}>
        <Ionicons name={winner === 0 ? 'git-compare-outline' : 'trophy-outline'} size={42} color={winner === 0 ? colors.winner : colors.background} />
      </View>
      <Text style={[styles.resultKicker, { color: colors.winner }]}>FINAL RESULT</Text>
      <Text style={[styles.resultTitle, { color: colors.foreground }]}>{winnerName}</Text>
      <Text style={[styles.resultSubtitle, { color: colors.mutedForeground }]}>
        {history.length} rounds complete. Every roll counted.
      </Text>
      <View style={styles.resultPlayers}>
        {[players[0], players[1]].map((player, index) => {
          const total = index === 0 ? p1Total : p2Total;
          const isWinner = winner === index + 1;
          const accent = index === 0 ? colors.playerOne : colors.playerTwo;
          return (
            <View key={player.accent} style={[styles.resultPlayer, { backgroundColor: colors.card, borderColor: isWinner ? colors.winner : colors.border }]}>
              <PlayerAvatar player={player} size={66} colors={colors} />
              <Text numberOfLines={1} style={[styles.resultPlayerName, { color: colors.foreground }]}>{player.name}</Text>
              <Text style={[styles.resultPlayerRole, { color: accent }]}>{isWinner ? 'WINNER' : winner === 0 ? 'TIED' : index === 0 ? 'PLAYER 1' : 'PLAYER 2'}</Text>
              <Text style={[styles.resultTotal, { color: isWinner ? colors.winner : colors.foreground }]}>{total}</Text>
              <Text style={[styles.resultPoints, { color: colors.mutedForeground }]}>points</Text>
            </View>
          );
        })}
      </View>
      <PrimaryButton label="Play Again" icon="refresh" onPress={onPlayAgain} colors={colors} />
      <View style={styles.resultLinkRow}>
        <Pressable onPress={onNewGame} style={({ pressed }) => [styles.resultLink, pressed && styles.pressed]}>
          <Ionicons name="people-outline" size={18} color={colors.mutedForeground} />
          <Text style={[styles.resultLinkText, { color: colors.mutedForeground }]}>New Game</Text>
        </Pressable>
        <Pressable onPress={onHome} style={({ pressed }) => [styles.resultLink, pressed && styles.pressed]}>
          <Ionicons name="home-outline" size={18} color={colors.mutedForeground} />
          <Text style={[styles.resultLinkText, { color: colors.mutedForeground }]}>Home</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function DiceBattleScreen() {
  const baseColors = useColors();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('home');
  const [players, setPlayers] = useState<[Player, Player]>(DEFAULT_PLAYERS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<RoundScore[]>([]);
  const [scores, setScores] = useState({ p1: [] as number[], p2: [] as number[] });
  const [turn, setTurn] = useState<1 | 2>(1);
  const [diceValue, setDiceValue] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [paused, setPaused] = useState(false);
  const [calculateVisible, setCalculateVisible] = useState(false);
  const [setupSettings, setSetupSettings] = useState(true);
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rollPlayer = useAudioPlayer(rollAudio);
  const resultPlayer = useAudioPlayer(resultAudio);
  const winnerPlayer = useAudioPlayer(winnerAudio);

  const colors = useMemo(
    () => (settings.theme === 'contrast' ? { ...gameThemes.contrast, radius: baseColors.radius } : { ...gameThemes.midnight, radius: baseColors.radius }),
    [baseColors.radius, settings.theme],
  );

  useEffect(() => {
    AsyncStorage.getItem('dice-battle-settings')
      .then((stored) => {
        if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('dice-battle-settings', JSON.stringify(settings)).catch(() => undefined);
  }, [settings]);

  useEffect(() => {
    return () => {
      if (rollTimer.current) clearInterval(rollTimer.current);
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  const playSound = (player: typeof rollPlayer) => {
    if (!settings.sound) return;
    void player.seekTo(0).then(() => player.play()).catch(() => player.play());
  };

  const vibrate = () => {
    if (settings.vibration) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const applyOrientation = (orientation: OrientationChoice) => {
    if (orientation === 'portrait') void ScreenOrientation.lockAsync(OrientationLock.PORTRAIT);
    else if (orientation === 'landscape') void ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE);
    else void ScreenOrientation.unlockAsync();
  };

  const updateSettings = (next: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...next }));
    if (next.orientation) applyOrientation(next.orientation);
  };

  const pickImage = async (index: 0 | 1) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPlayers((current) => {
        const next = [...current] as [Player, Player];
        next[index] = { ...next[index], image: result.assets[0].uri };
        return next;
      });
    }
  };

  const resetMatch = () => {
    if (rollTimer.current) clearInterval(rollTimer.current);
    setHistory([]);
    setScores({ p1: [], p2: [] });
    setTurn(1);
    setDiceValue(1);
    setRolling(false);
    setPaused(false);
    setCalculateVisible(false);
  };

  const startMatch = () => {
    resetMatch();
    applyOrientation(settings.orientation);
    setScreen('game');
  };

  const goHome = () => {
    if (rollTimer.current) clearInterval(rollTimer.current);
    void ScreenOrientation.unlockAsync();
    setPaused(false);
    setScreen('home');
  };

  const restartMatch = () => {
    Alert.alert('Restart this match?', 'The current score will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: resetMatch },
    ]);
  };

  const commitRoll = (value: number) => {
    setRolling(false);
    const roundIndex = history.length;
    if (turn === 1) {
      setScores((current) => ({ ...current, p1: [...current.p1, value] }));
      setTurn(2);
      playSound(resultPlayer);
      vibrate();
      return;
    }
    const nextHistory = [
      ...history,
      { round: roundIndex + 1, p1: scores.p1[roundIndex] ?? 0, p2: value },
    ];
    setScores((current) => ({ ...current, p2: [...current.p2, value] }));
    setHistory(nextHistory);
    setTurn(1);
    playSound(resultPlayer);
    vibrate();
    if (nextHistory.length >= settings.rounds) {
      playSound(winnerPlayer);
      if (settings.vibration) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resultTimer.current = setTimeout(() => setScreen('result'), 650);
    }
  };

  const handleRoll = () => {
    if (rolling || paused || screen !== 'game') return;
    setRolling(true);
    playSound(rollPlayer);
    vibrate();
    let ticks = 0;
    const finalValue = Math.floor(Math.random() * 6) + 1;
    rollTimer.current = setInterval(() => {
      ticks += 1;
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      if (ticks >= 9) {
        if (rollTimer.current) clearInterval(rollTimer.current);
        rollTimer.current = null;
        setDiceValue(finalValue);
        commitRoll(finalValue);
      }
    }, 105);
  };

  const beginNewGame = () => {
    setPlayers(DEFAULT_PLAYERS);
    resetMatch();
    setSetupSettings(true);
    setScreen('setup');
  };

  const playAgain = () => {
    resetMatch();
    setScreen('game');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {screen === 'home' ? (
        <HomeScreen
          colors={colors}
          settings={settings}
          onNewGame={beginNewGame}
          onHowTo={() => setScreen('howto')}
          onSettings={() => {
            setSetupSettings(false);
            setScreen('settings');
          }}
          onSoundToggle={(sound) => updateSettings({ sound })}
        />
      ) : null}
      {screen === 'setup' ? (
        <SetupScreen
          players={players}
          colors={colors}
          onBack={goHome}
          onChange={(index, name) => {
            setPlayers((current) => {
              const next = [...current] as [Player, Player];
              next[index] = { ...next[index], name: name.trimStart() };
              return next;
            });
          }}
          onPickImage={pickImage}
          onContinue={() => {
            setSetupSettings(true);
            setScreen('settings');
          }}
        />
      ) : null}
      {screen === 'settings' ? (
        <SettingsScreen
          settings={settings}
          colors={colors}
          fromSetup={setupSettings}
          onChange={updateSettings}
          onBack={setupSettings ? () => setScreen('setup') : goHome}
          onStart={startMatch}
        />
      ) : null}
      {screen === 'howto' ? <HowToScreen colors={colors} onBack={goHome} /> : null}
      {screen === 'game' ? (
        <GameScreen
          players={players}
          settings={settings}
          colors={colors}
          history={history}
          scores={scores}
          turn={turn}
          diceValue={diceValue}
          rolling={rolling}
          onRoll={handleRoll}
          onCalculate={() => setCalculateVisible(true)}
          onPause={() => setPaused(true)}
        />
      ) : null}
      {screen === 'result' ? (
        <ResultScreen
          players={players}
          history={history}
          colors={colors}
          onPlayAgain={playAgain}
          onNewGame={beginNewGame}
          onHome={goHome}
        />
      ) : null}
      <CalculateModal visible={calculateVisible} colors={colors} history={history} players={players} onClose={() => setCalculateVisible(false)} />
      <PauseModal
        visible={paused}
        colors={colors}
        onResume={() => setPaused(false)}
        onRestart={() => {
          setPaused(false);
          restartMatch();
        }}
        onHome={() => {
          setPaused(false);
          goHome();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  homeContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 28, paddingTop: 32 },
  formContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16 },
  resultContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 32, paddingTop: 34 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 62, marginBottom: 26 },
  headerSpacer: { width: 40 },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  headerSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  brandMark: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 54 },
  homeIcon: { width: 58, height: 58, borderRadius: 18 },
  brandKicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 2.5 },
  brandTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: 0.5, marginTop: 3 },
  homeHero: { marginBottom: 28 },
  homeHeadline: { fontFamily: 'Inter_700Bold', fontSize: 46, lineHeight: 51, letterSpacing: -1.5 },
  homeDescription: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, marginTop: 19, maxWidth: 330 },
  homeFeature: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 20 },
  homeSoundRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 18, padding: 10, paddingRight: 14, marginBottom: 20 },
  homeSoundCopy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIconSmall: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featureIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1 },
  featureTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  featureText: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  primaryButton: { minHeight: 56, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 20 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: 0.15 },
  homeLinkRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 22 },
  homeLink: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 5 },
  homeLinkText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  homeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 'auto', paddingTop: 34 },
  homeFooterText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.7, marginBottom: 11, marginTop: 5 },
  setupCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 14 },
  setupCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  numberBadge: { width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  numberBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  setupCardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  colorLine: { flex: 1, height: 2, opacity: 0.6, marginLeft: 3 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileActions: { flex: 1, gap: 10 },
  avatar: { borderWidth: 3 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nameInput: { height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontFamily: 'Inter_500Medium', fontSize: 15 },
  uploadButton: { height: 40, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  uploadText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  infoBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderRadius: 15, padding: 13, marginTop: 2, marginBottom: 20 },
  infoBannerText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 25 },
  choicePill: { minHeight: 44, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, flexGrow: 1 },
  choiceText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  settingsCard: { borderWidth: 1, borderRadius: 19, paddingHorizontal: 14, marginBottom: 24 },
  settingRow: { minHeight: 71, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingRowCopy: { flex: 1 },
  settingTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  settingDescription: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  rowDivider: { height: 1 },
  toggle: { width: 48, height: 28, borderRadius: 15, justifyContent: 'center', paddingHorizontal: 3 },
  toggleKnob: { width: 22, height: 22, borderRadius: 11 },
  aboutCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 23 },
  aboutTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  aboutText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 5 },
  privacyText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 15 },
  howtoHero: { borderWidth: 1, borderRadius: 22, padding: 22, marginBottom: 25 },
  howtoHeroTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 16 },
  howtoHeroText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8 },
  howtoRow: { flexDirection: 'row', gap: 15, marginBottom: 22 },
  howtoNumber: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  howtoNumberText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  howtoCopy: { flex: 1, paddingTop: 1 },
  howtoTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  howtoDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 5 },
  offlineNote: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 3 },
  offlineText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  gameContent: { flex: 1, paddingHorizontal: 18, paddingBottom: 14 },
  gameHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gameEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 2 },
  gameTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 4 },
  gameHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calculateButton: { height: 40, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11 },
  calculateText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  gameBoard: { flex: 1 },
  gameBoardLandscape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  portraitPlayers: { flexDirection: 'row', gap: 10, marginTop: 9 },
  playerCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 12, minHeight: 142, shadowOpacity: 0.18, shadowRadius: 13, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  landscapePlayerCard: { width: 188, minHeight: 180, padding: 16 },
  playerCardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  playerCardIdentity: { flex: 1 },
  playerEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1 },
  playerCardName: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 3 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  playerScoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 15, gap: 13 },
  scoreCaption: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  roundScore: { fontFamily: 'Inter_700Bold', fontSize: 27, marginTop: 1 },
  totalScore: { fontFamily: 'Inter_700Bold', fontSize: 21, marginTop: 5 },
  scoreDivider: { width: 1, height: 34, marginBottom: 1 },
  diceStage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 305 },
  turnPill: { borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 8, marginBottom: 22 },
  turnDot: { width: 7, height: 7, borderRadius: 4 },
  turnPillText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  dicePressable: { alignItems: 'center', justifyContent: 'center' },
  diceFace: { flexDirection: 'row', flexWrap: 'wrap', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 9 }, elevation: 12 },
  diceCell: { alignItems: 'center', justifyContent: 'center' },
  diceDot: { opacity: 0.95 },
  rollPrompt: { fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 22 },
  rollHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 7 },
  landscapeSide: { width: 190, justifyContent: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  calculateSheet: { maxHeight: '82%', borderWidth: 1, borderRadius: 26, padding: 18 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 3, marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  sheetEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 4 },
  emptyLedger: { alignItems: 'center', justifyContent: 'center', paddingVertical: 35 },
  emptyLedgerTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 12 },
  emptyLedgerText: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 7, maxWidth: 240, lineHeight: 18 },
  ledgerHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 10 },
  ledgerHeaderText: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  ledgerHeaderRoundLabel: { flex: 0.55 },
  ledgerRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 14 },
  ledgerRound: { flex: 0.55, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  ledgerScore: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 16 },
  ledgerTotals: { flexDirection: 'row', borderRadius: 13, paddingVertical: 14, paddingHorizontal: 10, marginTop: 13, marginBottom: 20 },
  ledgerTotalLabel: { flex: 0.55, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 },
  ledgerTotal: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20 },
  pauseCard: { borderWidth: 1, borderRadius: 24, padding: 22, marginBottom: 8 },
  pauseIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  pauseTitle: { fontFamily: 'Inter_700Bold', fontSize: 25 },
  pauseText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 7, marginBottom: 21 },
  homeModalButton: { alignItems: 'center', paddingVertical: 16 },
  homeModalText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  trophyCircle: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginTop: 14, marginBottom: 25 },
  resultKicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 2.2 },
  resultTitle: { fontFamily: 'Inter_700Bold', fontSize: 31, textAlign: 'center', marginTop: 9 },
  resultSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 8, textAlign: 'center' },
  resultPlayers: { flexDirection: 'row', width: '100%', gap: 11, marginTop: 30, marginBottom: 24 },
  resultPlayer: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: 14 },
  resultPlayerName: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 11, maxWidth: 100 },
  resultPlayerRole: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, marginTop: 5 },
  resultTotal: { fontFamily: 'Inter_700Bold', fontSize: 31, marginTop: 12 },
  resultPoints: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: -2 },
  resultLinkRow: { flexDirection: 'row', gap: 28, marginTop: 19 },
  resultLink: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8 },
  resultLinkText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});