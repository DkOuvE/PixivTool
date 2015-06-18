import {Link} from 'react-router';
module.exports = React.createClass({
  render: function () {
    return <div className="nav">
      <a href="#" className="nav-item nav-head">{ctx.m('common_app_name')}</a>
      <Link to="/" className="nav-item">Home</Link>
      <Link to="/site" className="nav-item">SiteSettings</Link>
      <Link to="/export" className="nav-item">Export</Link>
    </div>;
  }
});
