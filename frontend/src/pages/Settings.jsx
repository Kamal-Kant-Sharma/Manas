import React from "react";
import PageHeader from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useApp } from "../lib/store";
import { getVoices, speak } from "../lib/audio";
import { storage } from "../lib/storage";
import { toast } from "sonner";

export default function Settings() {
  const { profile, setProfile, settings, setSettings } = useApp();
  const voices = getVoices();

  const clearAll = () => {
    if (window.confirm("Delete ALL local data (sessions, presets, goals)? This cannot be undone.")) {
      storage.clearAll();
      window.location.reload();
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="settings"
        title="Preferences"
        description="Profile, audio & app behavior. Everything stored on this device."
      />
      <div className="p-6 md:p-10 space-y-6 max-w-3xl">
        <section className="border border-border p-5 rounded-sm bg-card">
          <div className="overline mb-4">profile</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Display name</Label>
              <Input value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} data-testid="settings-profile-name" />
            </div>
          </div>
        </section>

        <section className="border border-border p-5 rounded-sm bg-card">
          <div className="overline mb-4">audio</div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <Label>Sound feedback</Label>
              <div className="text-xs text-muted-foreground">Beeps + speech synthesis</div>
            </div>
            <Switch checked={settings.soundEnabled} onCheckedChange={(on) => setSettings({ soundEnabled: on })} data-testid="settings-sound-toggle" />
          </div>
          <div className="py-3 border-b border-border">
            <Label>Voice</Label>
            <Select value={settings.voiceName || ""} onValueChange={(v) => setSettings({ voiceName: v || null })}>
              <SelectTrigger className="mt-1" data-testid="settings-voice"><SelectValue placeholder="System default" /></SelectTrigger>
              <SelectContent>
                {voices.map((v) => <SelectItem key={v.name} value={v.name}>{v.name} ({v.lang})</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => speak("Testing, one two three", { voiceName: settings.voiceName })} data-testid="settings-voice-test">
              Test voice
            </Button>
          </div>
        </section>

        <section className="border border-border p-5 rounded-sm bg-card">
          <div className="overline mb-4">accessibility</div>
          <div className="flex items-center justify-between">
            <Label>Reduced motion</Label>
            <Switch checked={settings.reducedMotion} onCheckedChange={(on) => setSettings({ reducedMotion: on })} />
          </div>
        </section>

        <section className="border border-border p-5 rounded-sm bg-card">
          <div className="overline mb-4">danger zone</div>
          <div className="text-xs text-muted-foreground mb-3">Wipe all local sessions, presets, and goals.</div>
          <Button variant="destructive" onClick={clearAll} data-testid="settings-clear-all">Clear all data</Button>
        </section>
      </div>
    </div>
  );
}
