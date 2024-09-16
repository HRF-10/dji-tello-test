import { Injectable } from '@angular/core';
declare var chrome: any;

@Injectable({
  providedIn: 'root',
})
export class TelloService {
  private telloAddress = '192.168.10.1';
  private telloPort = 8889;
  private socketId: number | null = null;

  constructor() {
    document.addEventListener(
      'deviceready',
      () => {
        this.createSocket();
      },
      false
    );
  }

  createSocket() {
    if (chrome && chrome.sockets && chrome.sockets.udp) {
      chrome.sockets.udp.create({}, (socketInfo: any) => {
        this.socketId = socketInfo.socketId;
        console.log('Socket dibuat dengan ID:', this.socketId);
        this.bindSocket();
      });
    } else {
      console.error('Socket UDP tidak tersedia. Pastikan plugin terinstal.');
    }
  }

  bindSocket() {
    if (this.socketId !== null) {
      chrome.sockets.udp.bind(this.socketId, '0.0.0.0', 0, (result: any) => {
        if (result < 0) {
          console.error('Gagal bind socket:', chrome.runtime.lastError);
        } else {
          console.log('Socket berhasil di-bind ke port yang tersedia');
          this.listenForResponses();  // Mendengarkan respons setelah bind
        }
      });
    }
  }

  listenForResponses() {
    if (this.socketId !== null) {
      chrome.sockets.udp.onReceive.addListener((info: any) => {
        if (info.socketId === this.socketId) {
          const message = new TextDecoder().decode(new Uint8Array(info.data));
          console.log('Respons dari drone:', message);
        }
      });
    }
  }

  sendCommand(command: string) {
    if (this.socketId !== null) {
      const data = new TextEncoder().encode(command);
      chrome.sockets.udp.send(
        this.socketId,
        data.buffer,
        this.telloAddress,
        this.telloPort,
        (sendInfo: any) => {
          if (sendInfo.resultCode < 0) {
            console.error('Pengiriman gagal:', chrome.runtime.lastError);
          } else {
            console.log('Perintah berhasil dikirim:', command);
          }
        }
      );
    } else {
      console.error('Socket belum dibuat. Tidak bisa mengirim perintah.');
    }
  }
}