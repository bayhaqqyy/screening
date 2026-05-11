import pytest
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from screener_consumer import freeze_entry_price

def test_freeze_entry_price_with_existing():
    existing = {'entry_price': 1000, 'target': 1050}
    new_payload = {'price': 1020, 'entry_price': 1020, 'target': 1070}
    
    result = freeze_entry_price(existing, new_payload)
    assert result['entry_price'] == 1000
    assert result['target'] == 1070
    assert result['price'] == 1020

def test_freeze_entry_price_without_existing():
    existing = None
    new_payload = {'price': 1020, 'entry_price': 1020, 'target': 1070}
    
    result = freeze_entry_price(existing, new_payload)
    assert result['entry_price'] == 1020
    assert result['target'] == 1070

def test_freeze_entry_price_without_entry_price_in_existing():
    existing = {'target': 1050}
    new_payload = {'price': 1020, 'entry_price': 1020, 'target': 1070}
    
    result = freeze_entry_price(existing, new_payload)
    assert result['entry_price'] == 1020
    assert result['target'] == 1070
