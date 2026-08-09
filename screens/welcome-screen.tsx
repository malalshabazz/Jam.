import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getSignupPosition,
  markWelcomeSeen,
} from "@/lib/native-social-data";
import { fadeAnimatedValue, waitMs } from "@/lib/animation";
import { ordinal } from "@/lib/format";
import { styles } from "@/theme/styles";
import { PrimaryButton } from "@/components/ui/primary-button";

type WelcomePhase = "intro" | "position" | "messageOne" | "messageTwo";

export function WelcomeScreen({
  userId,
  onBack,
  onDone,
}: {
  userId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<WelcomePhase>("intro");
  const [number, setNumber] = useState(1);
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const introOpacity = useRef(new Animated.Value(0)).current;
  const positionOpacity = useRef(new Animated.Value(0)).current;
  const messageOneOpacity = useRef(new Animated.Value(0)).current;
  const messageTwoOpacity = useRef(new Animated.Value(0)).current;
  const introStartedRef = useRef(false);
  const transitioningRef = useRef(false);
  const leavingWelcomeRef = useRef(false);
  const [welcomeStageHeight, setWelcomeStageHeight] = useState(0);
  const [welcomePositionTextBottom, setWelcomePositionTextBottom] = useState(0);
  const welcomeForwardArrowOffset = 32;
  const welcomeForwardArrowTop =
    welcomeStageHeight > 0 && welcomePositionTextBottom > 0
      ? (welcomePositionTextBottom + welcomeStageHeight) / 2 - welcomeForwardArrowOffset
      : undefined;

  const backButton = (
    <Pressable onPress={() => void handleWelcomeBack()} style={styles.onboardingBackButton} accessibilityLabel="go back">
      <Text style={styles.onboardingBackText}>‹</Text>
    </Pressable>
  );

  useEffect(() => {
    void getSignupPosition(userId).then((position) => {
      setNumber(position);
    });
  }, [userId]);

  useEffect(() => {
    if (introStartedRef.current) return;
    introStartedRef.current = true;

    async function runIntroSequence() {
      await fadeAnimatedValue(screenOpacity, 1, 500);
      await fadeAnimatedValue(introOpacity, 1, 420);
      await waitMs(1000);
      await fadeAnimatedValue(introOpacity, 0, 380);
      await fadeAnimatedValue(positionOpacity, 1, 520);
      setPhase("position");
    }

    void runIntroSequence();
  }, [introOpacity, positionOpacity, screenOpacity]);

  async function openMessageOne() {
    if (phase !== "position" || transitioningRef.current) return;

    transitioningRef.current = true;
    setPhase("messageOne");
    messageOneOpacity.setValue(0);
    await Promise.all([
      fadeAnimatedValue(positionOpacity, 0, 360),
      fadeAnimatedValue(messageOneOpacity, 1, 460),
    ]);
    transitioningRef.current = false;
  }

  async function goBackToPosition() {
    if (phase !== "messageOne" || transitioningRef.current) return;

    transitioningRef.current = true;
    setPhase("position");
    positionOpacity.setValue(0);
    await Promise.all([
      fadeAnimatedValue(messageOneOpacity, 0, 360),
      fadeAnimatedValue(positionOpacity, 1, 460),
    ]);
    transitioningRef.current = false;
  }

  async function openMessageTwo() {
    if (phase !== "messageOne" || transitioningRef.current) return;

    transitioningRef.current = true;
    setPhase("messageTwo");
    messageTwoOpacity.setValue(0);
    await Promise.all([
      fadeAnimatedValue(messageOneOpacity, 0, 360),
      fadeAnimatedValue(messageTwoOpacity, 1, 460),
    ]);
    transitioningRef.current = false;
  }

  async function goBackToMessageOne() {
    if (phase !== "messageTwo" || transitioningRef.current) return;

    transitioningRef.current = true;
    setPhase("messageOne");
    messageOneOpacity.setValue(0);
    await Promise.all([
      fadeAnimatedValue(messageTwoOpacity, 0, 360),
      fadeAnimatedValue(messageOneOpacity, 1, 460),
    ]);
    transitioningRef.current = false;
  }

  function handleWelcomeTap() {
    if (phase === "position") {
      void openMessageOne();
      return;
    }

    if (phase === "messageOne") {
      void openMessageTwo();
    }
  }

  async function continueToFeed() {
    await markWelcomeSeen(userId);
    onDone();
  }

  async function handleWelcomeBack() {
    if (leavingWelcomeRef.current || transitioningRef.current) return;

    leavingWelcomeRef.current = true;
    transitioningRef.current = true;
    introOpacity.stopAnimation();
    positionOpacity.stopAnimation();
    messageOneOpacity.stopAnimation();
    messageTwoOpacity.stopAnimation();
    screenOpacity.stopAnimation();
    await fadeAnimatedValue(screenOpacity, 0, 300);
    onBack();
  }

  return (
    <Animated.View style={[styles.flex, { opacity: screenOpacity }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.flex}>
          <Pressable
            style={styles.welcomeStage}
            onPress={handleWelcomeTap}
            disabled={phase !== "position" && phase !== "messageOne"}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.welcomeBeat, styles.welcomeBeatLayer, { opacity: introOpacity }]}
            >
              <Text style={styles.welcomeIntroText}>a quick message...</Text>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[styles.welcomeBeat, styles.welcomeBeatLayer, { opacity: positionOpacity }]}
            >
              <View
                style={styles.welcomePositionLayout}
                onLayout={(event) => setWelcomeStageHeight(event.nativeEvent.layout.height)}
              >
                <View style={styles.welcomePositionTextWrap}>
                  <Text
                    style={[styles.h1, styles.welcomePositionText]}
                    onLayout={(event) => {
                      const { y, height } = event.nativeEvent.layout;
                      setWelcomePositionTextBottom(y + height);
                    }}
                  >
                    you are the {ordinal(number)} person to ever have Jam.
                  </Text>
                </View>
                {welcomeForwardArrowTop !== undefined ? (
                  <Text style={[styles.welcomeForwardHint, styles.welcomeForwardHintPositioned, { top: welcomeForwardArrowTop }]}>
                    ›
                  </Text>
                ) : null}
              </View>
            </Animated.View>

            {phase === "position" ? (
              <Pressable style={styles.welcomeBackTapZone} onPress={() => undefined} accessibilityLabel="inactive" />
            ) : null}

            {phase === "messageOne" || phase === "messageTwo" ? (
              <Animated.View
                pointerEvents={phase === "messageOne" ? "auto" : "none"}
                style={[styles.welcomeMessagePage, { opacity: messageOneOpacity }]}
              >
                <View style={styles.welcomeMessageOneLayout}>
                  <View style={styles.welcomeMessageOneTop}>
                    <Text style={[styles.longCopy, styles.welcomeMessageOneCopy]}>
                      This started as an idea from a bedroom — no corporate investors or connections, no starting fan base. You’re joining an empty platform, hopefully because of a passion for creativity, and because you have faith that this could change the game. And that means a lot to me.
                    </Text>
                  </View>
                  <View style={styles.welcomeMessageOneCenter}>
                    <Text style={styles.welcomeCallout}>As a thank you, accept a lifetime of pro features!</Text>
                  </View>
                  <View style={styles.welcomeMessageOneBottom} />
                  {phase === "messageOne" && welcomeForwardArrowTop !== undefined ? (
                    <Text
                      pointerEvents="none"
                      style={[styles.welcomeForwardHint, styles.welcomeForwardHintPositioned, { top: welcomeForwardArrowTop }]}
                    >
                      ›
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  style={styles.welcomeBackTapZone}
                  onPress={() => void goBackToPosition()}
                  accessibilityLabel="go back"
                />
              </Animated.View>
            ) : null}

            {phase === "messageTwo" ? (
              <Animated.View
                style={[styles.welcomeBeat, styles.welcomeBeatLayer, { opacity: messageTwoOpacity }]}
              >
                <View style={styles.welcomeMessageTwoContent}>
                  <Text style={[styles.longCopy, styles.welcomeMessageOneCopy]}>
                    And keep in mind — the feed might be empty to begin with, but as long as people like you continue to have faith, it will grow before our eyes and you will find what you’re looking for. Welcome to Jam.
                  </Text>
                  <PrimaryButton
                    label="start jamming"
                    onPress={() => void continueToFeed()}
                    style={styles.welcomeMessageTwoButton}
                  />
                </View>
                <Pressable
                  style={styles.welcomeBackTapZone}
                  onPress={() => void goBackToMessageOne()}
                  accessibilityLabel="go back"
                />
              </Animated.View>
            ) : null}
          </Pressable>

          {phase === "messageOne" || phase === "messageTwo" ? (
            <View style={styles.welcomeHeaderOverlay}>
              {backButton}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}
