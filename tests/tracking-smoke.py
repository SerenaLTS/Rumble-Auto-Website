"""Offline browser checks. Requires Python playwright + installed Chromium.
Run: python3 tests/tracking-smoke.py
All requests are intercepted; no live leads or advertising requests are sent.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
KEY = 'rumble_cookie_consent_v3'

with sync_playwright() as p:
    browser = p.chromium.launch()
    for mobile in (False, True):
        context = browser.new_context(viewport={'width': 390 if mobile else 1440, 'height': 844 if mobile else 1000})
        submissions = []
        api_result = {'status': 200, 'body': '{"ok":true}'}
        def route_request(route):
            from urllib.parse import urlparse, unquote
            url = urlparse(route.request.url)
            if url.hostname == 'api.rumbleauto.com.au':
                submissions.append(json.loads(route.request.post_data))
                route.fulfill(status=api_result['status'], content_type='application/json', body=api_result['body'], headers={'Access-Control-Allow-Origin': '*'})
            elif url.hostname == 'www.rumbleauto.com.au':
                file = (ROOT / unquote(url.path.lstrip('/') or 'index.html')).resolve()
                if file.is_relative_to(ROOT) and file.is_file():
                    route.fulfill(path=str(file))
                else:
                    route.fulfill(status=404)
            else:
                route.abort()
        context.route('**/*', route_request)
        page = context.new_page()
        page.add_init_script("localStorage.setItem('rumble_cookie_consent_v2','accepted')")
        page.goto('https://www.rumbleauto.com.au/index_mobile.html' if mobile else 'https://www.rumbleauto.com.au/index.html')
        banner = page.locator('#cookieConsentBanner')
        banner.wait_for()
        default = page.evaluate('Array.from(dataLayer[0])')
        assert default[0:2] == ['consent', 'default']
        assert default[2]['ad_user_data'] == default[2]['analytics_storage'] == 'denied'
        # Old analytics consent is not silently promoted to advertising consent.
        banner.locator('[data-consent=analytics]').click()
        assert page.evaluate('rumbleConsent.getChoice()') == {'version': 3, 'analytics': True, 'marketing': False}
        page.reload()
        assert page.locator('#cookieConsentBanner').count() == 0
        assert page.evaluate('dataLayer[0][2].ad_user_data') == 'denied'
        page.locator('[data-cookie-settings]').click()
        page.locator('[data-consent=accept]').click()
        assert page.evaluate('rumbleCookieConsent.hasMarketingConsent()')
        # Banner fits viewport and all buttons remain reachable on desktop/mobile.
        page.locator('[data-cookie-settings]').click()
        bounds = banner.bounding_box()
        assert bounds['x'] >= 0 and bounds['y'] >= 0
        assert bounds['x'] + bounds['width'] <= page.viewport_size['width'] + 1
        page.screenshot(path=f'/tmp/rumble-consent-{ "mobile" if mobile else "desktop" }.png')
        page.locator('[data-consent=accept]').click()
        form = page.locator('form#enquiryForm, form.js-form').first
        form.locator('[name=name]').fill('Offline Test')
        form.locator('[name=contact]').fill('offline@example.com')
        form.locator('[name=enquiry_type]').select_option(label='General Enquiry')
        form.locator('[name=message]').fill('Offline browser test. This is never sent to the live API.')
        page.evaluate("document.querySelector('form#enquiryForm, form.js-form').dataset.enquiryStartedAt = '1'")
        def leads():
            return page.evaluate("dataLayer.filter(x => x.event === 'rumble_lead_submit')")
        assert not leads()
        # HTTP failures and malformed/ambiguous successes must not create conversions.
        for result in ({'status': 500, 'body':'{"ok":false}'}, {'status':200,'body':'{}'}, {'status':200,'body':'invalid json'}):
            api_result.update(result)
            form.locator('[type=submit]').click()
            page.wait_for_function("document.querySelector('form#enquiryForm, form.js-form').dataset.enquirySubmitting === 'false'")
            assert not leads()
        assert len({x['idempotency_key'] for x in submissions}) == 1
        assert all(x['tracking_consent'] == {'version': 3, 'marketing': True} for x in submissions)
        api_result.update(status=200, body='{"ok":true}')
        form.locator('[type=submit]').click()
        page.wait_for_function("dataLayer.some(x => x.event === 'rumble_lead_submit')")
        event = leads()[0]
        assert event['event_id'] == event['transaction_id'] == submissions[-1]['event_id']
        assert event['lead_type'] == 'General Enquiry' and event['marketing_consent'] is True
        assert 'offline@example.com' not in json.dumps(event) and 'contact' not in event
        # A repeated identical submission is blocked by the existing duplicate guard.
        count = len(submissions)
        form.locator('[name=name]').fill('Offline Test')
        form.locator('[name=contact]').fill('offline@example.com')
        form.locator('[name=enquiry_type]').select_option(label='General Enquiry')
        form.locator('[name=message]').fill('Offline browser test. This is never sent to the live API.')
        form.locator('[type=submit]').click()
        assert len(submissions) == count and len(leads()) == 1
        # Rejecting tracking still permits submitting the enquiry.
        page.locator('[data-cookie-settings]').click()
        page.locator('[data-consent=reject]').click()
        assert not page.evaluate('rumbleCookieConsent.hasMarketingConsent()')
        form.locator('[name=message]').fill('A different offline enquiry after rejecting tracking.')
        form.locator('[type=submit]').click()
        page.wait_for_function("document.querySelector('form#enquiryForm, form.js-form').dataset.enquirySubmitting === 'false'")
        assert len(submissions) == count + 1 and len(leads()) == 1
        assert submissions[-1]['tracking_consent']['marketing'] is False
        assert 'meta_fbp' not in submissions[-1] and 'meta_fbc' not in submissions[-1]
        assert 'has been submitted' in form.locator('.form-status').inner_text()
        # A broken tag/dataLayer must never show a failed enquiry to the customer.
        page.evaluate("() => { rumbleConsent.setChoice(true,true); dataLayer.push = () => { throw new Error('test tag failure') }; }")
        form.locator('[name=name]').fill('Offline Test')
        form.locator('[name=contact]').fill('offline@example.com')
        form.locator('[name=enquiry_type]').select_option(label='General Enquiry')
        form.locator('[name=message]').fill('Tracking error should not affect the saved enquiry.')
        form.locator('[type=submit]').click()
        page.wait_for_function("document.querySelector('form#enquiryForm, form.js-form').dataset.enquirySubmitting === 'false'")
        assert 'has been submitted' in form.locator('.form-status').inner_text()
        context.close()
        print(f'PASS: {"mobile" if mobile else "desktop"} consent, persistence, submission failures, success, duplicates, rejection, tag failure')
    browser.close()
