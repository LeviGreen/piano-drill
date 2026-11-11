import { Route, Routes } from 'react-router'
import { AppShell } from './ui/AppShell'
import { CorpusRecorderScreen } from './ui/CorpusRecorderScreen'
import { MicTestScreen } from './ui/MicTestScreen'
import { FlashTestScreen } from './ui/FlashTestScreen'
import { GeneratorPreviewScreen } from './ui/GeneratorPreviewScreen'
import { KeyIdPreviewScreen } from './ui/KeyIdPreviewScreen'
import { SessionDemoScreen } from './ui/SessionDemoScreen'
import { NotationGalleryScreen } from './ui/NotationGalleryScreen'
import { HomeScreen, KeyIdScreen, NotFoundScreen, PlayScreen, SettingsScreen } from './ui/screens'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeScreen />} />
        <Route path="play" element={<PlayScreen />} />
        <Route path="key-id" element={<KeyIdScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="settings/mic-test" element={<MicTestScreen />} />
        <Route path="settings/corpus-recorder" element={<CorpusRecorderScreen />} />
        <Route path="settings/notation-gallery" element={<NotationGalleryScreen />} />
        <Route path="settings/generator-preview" element={<GeneratorPreviewScreen />} />
        <Route path="settings/flash-test" element={<FlashTestScreen />} />
        <Route path="settings/key-id-preview" element={<KeyIdPreviewScreen />} />
        <Route path="settings/session-demo" element={<SessionDemoScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  )
}
