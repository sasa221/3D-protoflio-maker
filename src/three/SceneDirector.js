/**
 * SceneDirector.js
 * Controls cinematic 3D camera composition, scene rotation, FOV,
 * and object transforms based on scroll progress and theme profiles.
 */

import * as THREE from 'three';
import { CINEMATIC_PROFILES, getCinematicProfileKey } from './CinematicProfiles.js';

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export class SceneDirector {
  constructor(engine) {
    this.engine = engine;
    this.currentTheme = null;
    this.themeProfile = 'default';
    this.isProjectFocus = false;
    this.deviceMode = 'desktop';
    this.viewMode = 'cinematic';

    this.state = {
      position: new THREE.Vector3(0, 0, 80),
      target: new THREE.Vector3(0, 0, 0),
      fov: 60,
      sceneRotationY: 0,
      coreScale: 1,
      parallaxStrength: 8
    };

    this.profiles = CINEMATIC_PROFILES;
  }

  setDeviceMode(mode = 'desktop') {
    this.deviceMode = mode;
  }

  setViewMode(mode = 'cinematic') {
    this.viewMode = mode;
  }

  setTheme(theme) {
    this.currentTheme = theme;
    if (!theme) {
      this.themeProfile = 'default';
      return;
    }

    this.themeProfile = getCinematicProfileKey(theme.id);
  }

  setProjectFocus(enable = true) {
    this.isProjectFocus = Boolean(enable);
    if (this.isProjectFocus) {
      const shot = this.getShot('projectFocus');
      this.engine?.setCameraState({
        position: { x: shot.pos[0], y: shot.pos[1], z: shot.pos[2] },
        target: { x: shot.target[0], y: shot.target[1], z: shot.target[2] },
        fov: shot.fov,
        sceneRotationY: shot.rotY,
        coreScale: shot.coreScale,
        parallaxStrength: shot.parallax
      });
    }
  }

  getShot(sectionKey) {
    const profile = this.profiles[this.themeProfile] || this.profiles.default;
    if (this.isProjectFocus && sectionKey === 'projects') {
      return profile.projectFocus || profile.projects || profile.hero;
    }

    const isMobile = this.deviceMode === 'mobile' || (
      typeof window !== 'undefined' && window.innerWidth <= 640
    );

    if (sectionKey === 'hero' && isMobile && profile.mobileHero) {
      return profile.mobileHero;
    }

    return profile[sectionKey] || profile.hero;
  }

  update({ section, nextSection, progress }) {
    if (!this.engine || this.isProjectFocus) return;

    const shotA = this.getShot(section || 'hero');
    const shotB = this.getShot(nextSection || section || 'hero');

    const p = Math.max(0, Math.min(1, progress || 0));
    const t = easeInOutQuad(p);
    const isRecruiter = this.viewMode === 'recruiter';
    const motionScale = isRecruiter ? 0.35 : 1.0;

    // Interpolate position
    const posA = shotA.pos;
    const posB = shotB.pos;
    const posX = posA[0] + (posB[0] - posA[0]) * t * motionScale;
    const posY = posA[1] + (posB[1] - posA[1]) * t * motionScale;
    const posZ = posA[2] + (posB[2] - posA[2]) * t * motionScale;

    // Interpolate target
    const tgtA = shotA.target;
    const tgtB = shotB.target;
    const tgtX = tgtA[0] + (tgtB[0] - tgtA[0]) * t * motionScale;
    const tgtY = tgtA[1] + (tgtB[1] - tgtA[1]) * t * motionScale;
    const tgtZ = tgtA[2] + (tgtB[2] - tgtA[2]) * t * motionScale;

    // Interpolate options
    const fov = shotA.fov + (shotB.fov - shotA.fov) * t * motionScale;
    const rotY = (shotA.rotY + (shotB.rotY - shotA.rotY) * t) * (isRecruiter ? 0.3 : 1.0);
    const coreScale = shotA.coreScale + (shotB.coreScale - shotA.coreScale) * t;
    const parallax = (shotA.parallax + (shotB.parallax - shotA.parallax) * t) * (isRecruiter ? 0.25 : 1.0);

    // Pass to HyperEngine
    this.engine.setCameraState({
      position: { x: posX, y: posY, z: posZ },
      target: { x: tgtX, y: tgtY, z: tgtZ },
      fov: fov,
      sceneRotationY: rotY,
      coreScale: coreScale,
      parallaxStrength: parallax
    });
  }
}
