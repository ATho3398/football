// 안드로이드 앱 감지 (C.77v): window.Capacitor.isNativePlatform() 이 참일 때만 앱
import { afterEach, describe, expect, it } from 'vitest';
import { isNativeApp } from '../src/pwa/register';

const g = globalThis as { Capacitor?: unknown };

describe('isNativeApp', () => {
  afterEach(() => {
    delete g.Capacitor;
  });
  it('웹(Capacitor 없음)은 앱이 아니다', () => {
    expect(isNativeApp()).toBe(false);
  });
  it('Capacitor 웹 대체(isNativePlatform 거짓)는 앱이 아니다', () => {
    g.Capacitor = { isNativePlatform: () => false };
    expect(isNativeApp()).toBe(false);
  });
  it('안드로이드 앱 안에서는 참', () => {
    g.Capacitor = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
  });
});
