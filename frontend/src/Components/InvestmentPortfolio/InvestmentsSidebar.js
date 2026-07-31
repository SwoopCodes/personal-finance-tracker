import React from 'react';
import './InvestmentsSidebar.css';

const InvestmentsSidebar = ({ investments, selectedTicker, onSelect, onAdd }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Investments</h3>
        <div className="sidebar-actions">
          <button className="btn-add-account" onClick={onAdd}>+</button>
        </div>
      </div>
      <ul className="account-list">
        {investments.map(pos => {
          const dayChangeClass = pos.dayChangePct >= 0 ? 'positive' : 'negative';
          const pl = Math.abs(pos.unrealizedPL) < 0.005 ? 0 : pos.unrealizedPL;
          const plClass = pl >= 0 ? 'positive' : 'negative';
          return (
            <li
              key={pos.ticker}
              className={`investment-item ${selectedTicker === pos.ticker ? 'active' : ''}`}
              onClick={() => onSelect(pos.ticker)}
            >
              <div className="investment-item-top">
                <span className="investment-ticker">{pos.ticker}</span>
                <span className="investment-price">${pos.currentPrice.toFixed(2)}</span>
              </div>
              <div className="investment-item-bottom">
                <span className={`investment-day-change ${dayChangeClass}`}>
                  {pos.dayChangePct >= 0 ? '+' : ''}{pos.dayChangePct.toFixed(2)}% today
                </span>
                <span className={`investment-pl ${plClass}`}>
                  {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                </span>
              </div>
              <div className="investment-item-balance">
                ${pos.marketValue.toFixed(2)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default InvestmentsSidebar;
