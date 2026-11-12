import { Route, Routes } from 'react-router'
import { AppShell } from './ui/AppShell'
import { CorpusRecorderScreen } from './ui/CorpusRecorderScreen'
import { MicTestScreen } from './ui/MicTestScreen'
import { FlashTestScreen } from './ui/FlashTestScreen'
import { GeneratorPreviewScreen } from './ui/GeneratorPreviewScreen'
import { KeyIdScreen } from './ui/KeyIdScreen'
import { PlayScreen } from './ui/PlayScreen'
import { NotationGalleryScreen } from './ui/NotationGalleryScreen'
import { ScoresScreen } from './ui/ScoresScreen'
import { HomeScreen, NotFoundScreen, SettingsScreen } from './ui/screens'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeScreen />} />
        <Route path="play" element={<PlayScreen />} />
        <Route path="key-id" element={<KeyIdScreen />} />
        <Route path="scores" element={<ScoresScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="settings/mic-test" element={<MicTestScreen />} />
        <Route path="settings/corpus-recorder" element={<CorpusRecorderScreen />} />
        <Route path="settings/notation-gallery" element={<NotationGalleryScreen />} />
        <Route path="settings/generator-preview" element={<GeneratorPreviewScreen />} />
        <Route path="settings/flash-test" element={<FlashTestScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  )
}
