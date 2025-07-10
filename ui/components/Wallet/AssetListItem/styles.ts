export default `
  .asset_list_item {
    height: 72px;
    width: 100%;
    border-radius: 16px;
    background-color: var(--secondary-bg);
    display: flex;
    padding: 16px;
    box-sizing: border-box;
    margin-bottom: 16px;
    justify-content: space-between;
    align-items: center;
    gap: 8px
  }
  .asset_list_item:hover {
    background-color: var(--green-80);
  }
  .asset_left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .asset_left_content {
    display: flex;
    align-items: center;
  }
  .asset_right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .asset_symbol {
    color: var(--primary-text);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
  .asset_amount {
    color: var(--primary-text);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    text-align: right;
  }
  .bold_amount_count {
    color: var(--primary-text);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
`
