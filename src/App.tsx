import { Route, Routes } from 'react-router'
import { AppShell } from './ui/AppShell'
import { MicTestScreen } from './ui/MicTestScreen'
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
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  )
}
