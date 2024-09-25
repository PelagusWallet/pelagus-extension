export default `
  .asset_list_item {
    height: 72px;
    width: 100%;
    border-radius: 16px;
    background-color: var(--green-95);
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
  }
  .asset_left_content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-left: 16px;
  }
  .asset_right {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
  .asset_amount {
    color: var(--green-20);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: 0.42px;
    line-height: 16px;
    text-transform: uppercase;
    overflow-wrap: anywhere;
    word-break: break-all;
  }
  .asset_list_item:hover .asset_amount{
    color: #FFFFFF
  }
  .bold_amount_count {
    width: 70px;
    height: 24px;
    color: var(--green-20);
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
    margin-right: 4px;
  }
  .asset_list_item:hover .bold_amount_count{
    color: #FFFFFF;
  }
`
