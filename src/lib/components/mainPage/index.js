import MainContainer from "./MainContainer.svelte";
import GhostContainer from "./GhostContainer.svelte";
import ContentContainer from "./ContentContainer.svelte";
import FooterComponent from "./FooterComponent.svelte";
import AnimatedTitle from "./AnimatedTitle.svelte";
import AudioVisualizer from "./audio-transcript/AudioVisualizer.svelte";
import RecordButtonWithTimer from "./audio-transcript/RecordButtonWithTimer.svelte";
import TranscriptDisplay from "./audio-transcript/TranscriptDisplay.svelte";
import PermissionError from "./audio-transcript/PermissionError.svelte";
import { AboutModal, ExtensionModal, IntroModal } from "./modals";

export {
  MainContainer,
  GhostContainer,
  ContentContainer,
  FooterComponent,
  AnimatedTitle,
  AudioVisualizer,
  RecordButtonWithTimer,
  TranscriptDisplay,
  PermissionError,
  AboutModal,
  ExtensionModal,
  IntroModal,
};
