// Simplified and safer email-sender.js
const path = require('path');
const fs = require('fs');
// Load .env from project root (parent of scripts/)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const nodemailer = require('nodemailer');
const { SocksProxyAgent } = require('socks-proxy-agent');

const CONNECT_TIMEOUT_MS = 25000; // fail after 25s instead of hanging

class EmailSender {
  constructor() {
    this.emailOutputDir = './docs/email-output';
    this.subscribersFile = './subscribers.json';
  }

  createGmailTransporter() {
    const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
    let smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

    // Debug: confirm env vars are loaded (never log actual values)
    const userSet = !!smtpUser;
    const passSet = !!smtpPass;
    const passLen = smtpPass ? String(smtpPass).replace(/\s+/g, '').length : 0;
    console.log(`Credentials: GMAIL_USER/SMTP_USER ${userSet ? 'set' : 'MISSING'}, GMAIL_APP_PASSWORD/SMTP_PASS ${passSet ? 'set (length ' + passLen + ')' : 'MISSING'}. App passwords are 16 characters.`);

    if (!smtpUser || !smtpPass) {
      throw new Error('Missing SMTP credentials. Set SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD.');
    }

    smtpPass = smtpPass.replace(/\s+/g, '');

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(
      process.env.SMTP_PORT ||
      (process.env.GMAIL_USE_465 === 'true' ? 465 : 587)
    );
    const smtpSecure = process.env.SMTP_SECURE === 'true'
      ? true
      : smtpPort === 465;

    const enableDebug = process.env.SMTP_DEBUG === 'true';
    const socksProxyUrl = process.env.SMTP_SOCKS_PROXY;

    const transportOptions = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      pool: false,
      connectionTimeout: CONNECT_TIMEOUT_MS,
      greetingTimeout: 15000,
      socketTimeout: 60000,
      logger: enableDebug,
      debug: enableDebug,
      tls: {
        minVersion: 'TLSv1.2',
        servername: smtpHost,
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    };

    if (socksProxyUrl) {
      transportOptions.agent = new SocksProxyAgent(socksProxyUrl);
    }

    return nodemailer.createTransport(transportOptions);
  }

  loadSubscribers() {
    if (!fs.existsSync(this.subscribersFile)) throw new Error('No subscribers.json file found');
    return JSON.parse(fs.readFileSync(this.subscribersFile, 'utf8')).subscribers;
  }

  loadEmailContent(emailFile) {
    const filePath = path.join(this.emailOutputDir, emailFile);
    if (!fs.existsSync(filePath)) throw new Error(`Email file not found: ${filePath}`);
    return fs.readFileSync(filePath, 'utf8');
  }

  loadImageManifest(emailFile) {
    const manifestPath = path.join(this.emailOutputDir, emailFile.replace('.html', '-images.json'));
    return fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  }

  prepareAttachments(imageManifest) {
    return imageManifest.map(({ src, cid }) => {
      const cleanPath = src.replace(/^.*images-optimized\//, '');
      const filePath = path.resolve('docs/images-optimized', cleanPath);
      
      // Fail fast on missing attachments
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing attachment: ${filePath}`);
      }
      
      return {
        filename: path.basename(cleanPath),
        path: filePath,
        cid
      };
    });
  }

  htmlToText(html) {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, '').trim();
  }

  async send(transporter, { to, bcc = [], subject, html, attachments }) {
    const from = transporter.options.auth.user;
    const text = this.htmlToText(html);
    const mailOptions = { from, to, bcc, subject, html, text, attachments };
    return transporter.sendMail(mailOptions);
  }

  async confirmAndSendAll(transporter, emailFile, subject) {
    const subscribers = this.loadSubscribers();
    const confirmation = await this.confirmMassSend(subscribers.length);
    if (!confirmation) return;
    const html = this.loadEmailContent(emailFile);
    const attachments = this.prepareAttachments(this.loadImageManifest(emailFile));
    const result = await this.send(transporter, {
      to: process.env.GMAIL_USER,
      bcc: subscribers.map(sub => sub.email),
      subject,
      html,
      attachments
    });
    console.log(`✅ Sent to all (${subscribers.length}) via BCC. Message ID: ${result.messageId}`);
  }

  async sendToOne(transporter, recipient, emailFile, subject) {
    const skipVerify = process.env.SKIP_VERIFY === 'true';
    if (!skipVerify) {
      console.log('Connecting to SMTP server... (set SKIP_VERIFY=true to skip)');
      try {
        await Promise.race([
          transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timed out after 25s. Check network/firewall or set SKIP_VERIFY=true to try sending anyway.')), CONNECT_TIMEOUT_MS)
          )
        ]);
      } catch (err) {
        console.error('Verify failed:', err.message);
        if (err.code === 'EAUTH') throw err;
        console.log('Tip: Run with SKIP_VERIFY=true to attempt send without verify.');
        throw err;
      }
      console.log('✅ SMTP connection verified');
    } else {
      console.log('Skipping SMTP verify (SKIP_VERIFY=true).');
    }

    console.log('Loading email content and attachments...');
    const html = this.loadEmailContent(emailFile);
    const attachments = this.prepareAttachments(this.loadImageManifest(emailFile));
    const totalMB = (attachments.reduce((s, a) => s + (fs.existsSync(a.path) ? fs.statSync(a.path).size : 0), 0) / 1024 / 1024).toFixed(2);
    console.log(`  ${attachments.length} attachments (${totalMB} MB)`);
    
    // Size sanity check
    const approxSize = attachments.reduce((s, a) => s + (fs.existsSync(a.path) ? fs.statSync(a.path).size : 0), 0);
    if (approxSize > 20 * 1024 * 1024) {
      console.warn(`⚠️ Email size is ${(approxSize / 1024 / 1024).toFixed(1)}MB. Consider fewer/lighter images.`);
    }

    console.log('Sending email...');
    const result = await this.send(transporter, {
      to: recipient,
      subject,
      html,
      attachments
    });
    console.log(`✅ Sent to ${recipient}. Message ID: ${result.messageId}`);
  }

  async confirmMassSend(count) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
      rl.question(`⚠️ Are you sure you want to send to ALL ${count} subscribers? (yes/no): `, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      });
    });
  }
}

(async () => {
  const sender = new EmailSender();
  const [_, __, emailFile, subject = 'Michael\'s Travel Newsletter', recipient] = process.argv;
  if (!emailFile) return console.error('❌ Please specify an email file.');

  console.log('Creating transporter...');
  const transporter = sender.createGmailTransporter();
  if (recipient) {
    await sender.sendToOne(transporter, recipient, emailFile, subject);
  } else {
    await sender.confirmAndSendAll(transporter, emailFile, subject);
  }
})().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
