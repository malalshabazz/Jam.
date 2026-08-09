import { Text } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { styles } from "@/theme/styles";
import { CREATE_CAMERA_CONTROL_ICON_SIZE } from "@/theme/tokens";
import type { RecordingTimerSeconds } from "@/types/app";

export function CreateEditTrimIcon({ active = false }: { active?: boolean }) {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  const strokeWidth = active ? 2.3 : 1.8;
  const stroke = "#fff";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={7.8} cy={6.8} r={2.55} stroke={stroke} strokeWidth={strokeWidth} />
      <Circle cx={16.2} cy={6.8} r={2.55} stroke={stroke} strokeWidth={strokeWidth} />
      <Path
        d="M7.8 9.25 L12 11.15 L5.7 19.35"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.2 9.25 L12 11.15 L18.3 19.35"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={11.15} r={1.05} fill={stroke} />
    </Svg>
  );
}

export function CreateEditTextIcon({ active = false }: { active?: boolean }) {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  const strokeWidth = active ? 2.4 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 7h12" stroke="#fff" strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M12 7v12" stroke="#fff" strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M10 19h4" stroke="#fff" strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

function filterIconArcPath(cx: number, cy: number, radius: number, startDeg: number, endDeg: number) {
  const toPoint = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const start = toPoint(startDeg);
  const end = toPoint(endDeg);
  let delta = endDeg - startDeg;
  if (delta < 0) delta += 360;
  const largeArc = delta > 180 ? 1 : 0;

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function CreateCameraFilterIcon({ active = false }: { active?: boolean }) {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  const strokeWidth = active ? 2.55 : 2.15;
  const stroke = "#fff";
  const radius = 5.15;
  const top = { cx: 12, cy: 8.15 };
  const bottomLeft = { cx: 8.05, cy: 15.85 };
  const bottomRight = { cx: 15.95, cy: 15.85 };

  return (
    <Svg width={size} height={size} viewBox="-1 -1 26 26" fill="none">
      <Path
        d={filterIconArcPath(top.cx, top.cy, radius, 150, 79)}
        stroke={stroke}
        strokeWidth={strokeWidth * 0.88}
        strokeLinecap="round"
        opacity={0.5}
      />
      <Path
        d={filterIconArcPath(bottomLeft.cx, bottomLeft.cy, radius, 40, 320)}
        stroke={stroke}
        strokeWidth={strokeWidth * 0.94}
        strokeLinecap="round"
        opacity={0.72}
      />
      <Circle
        cx={bottomRight.cx}
        cy={bottomRight.cy}
        r={radius}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill={active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.11)"}
      />
    </Svg>
  );
}

export function CreateCameraFlipIcon() {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  const strokeWidth = 2.2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Two circular arrows — flip / switch camera */}
      <Path
        d="M7.2 6.4a7.2 7.2 0 0 1 11.1 2.4"
        stroke="#fff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M18.6 5.2v4.1h-4.1"
        stroke="#fff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.8 17.6a7.2 7.2 0 0 1-11.1-2.4"
        stroke="#fff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M5.4 18.8v-4.1h4.1"
        stroke="#fff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CreateCameraFlashIcon({ enabled }: { enabled: boolean }) {
  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
        stroke="#fff"
        strokeWidth={enabled ? 2.6 : 2.2}
        fill={enabled ? "#fff" : "none"}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CreateCameraTimerIcon({ seconds }: { seconds: RecordingTimerSeconds }) {
  if (seconds > 0) {
    return <Text style={styles.createCameraSideRailText}>{seconds}s</Text>;
  }

  const size = CREATE_CAMERA_CONTROL_ICON_SIZE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13" r="8" stroke="#fff" strokeWidth={2.2} />
      <Path d="M12 9.5v4.2l2.4 1.8" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 3.5h6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
